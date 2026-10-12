#!/usr/bin/env python3
"""Coordinator-only verification and immutable retention of finished authors.

Usage: python3 -B tools/agent-benchmark/audit-authors.py LANE --output /new/audit

Reads only the configured public author recorder and finished scene workspace.
It never reads provider/session files, contacts authors, launches containers or
browsers, or modifies an existing evidence file. Every output directory is new,
including a failed audit. Run final renders from the retained source/dist copy.
"""

from __future__ import annotations

import argparse
from collections import Counter
import datetime as dt
import fcntl
import importlib.util
import json
import math
import os
from pathlib import Path
import re
import stat
import sys


SPEC = importlib.util.spec_from_file_location("benchmark_author_recorder", Path(__file__).with_name("author-lane.py"))
LANE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(LANE)
SCHEMA = "aperture.author-audit.v1"
require = LANE.require


def read_regular(path, *, immutable=True):
    require(path.resolve() == path and not path.is_symlink(), "Audit inputs must not contain symbolic links")
    descriptor = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    with os.fdopen(descriptor, "rb") as file:
        before = os.fstat(file.fileno())
        require(stat.S_ISREG(before.st_mode), "Audit input is not a regular file")
        require(not immutable or before.st_mode & 0o222 == 0, "Finished evidence input is not immutable")
        data = file.read()
        after = os.fstat(file.fileno())
        require((before.st_dev, before.st_ino, before.st_size, before.st_mtime_ns) == (after.st_dev, after.st_ino, after.st_size, after.st_mtime_ns), "Audit input changed while being read")
        return data


def read_json(path, *, immutable=True):
    return json.loads(read_regular(path, immutable=immutable))


def finite(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def close_seconds(actual, expected, label):
    require(finite(actual) and abs(actual - expected) <= 0.000001, label + " differs from monotonic accounting")


def timestamp(value):
    require(isinstance(value, str), "UTC timestamp is missing")
    try:
        result = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as error:
        raise LANE.LaneError("UTC timestamp is invalid") from error
    require(result.tzinfo is not None and result.utcoffset() == dt.timedelta(0), "Timestamp must be UTC")
    return result


def read_events(root):
    raw = read_regular(root / "events.jsonl", immutable=False)
    require(raw.endswith(b"\n"), "Public event stream has an incomplete trailing record")
    events = []
    previous_hash = "0" * 64
    previous_time = -1
    for index, line in enumerate(raw.splitlines(), 1):
        record = json.loads(line)
        require(isinstance(record, dict), "Invalid public event record")
        claimed = record.get("sha256")
        unhashed = {key: value for key, value in record.items() if key != "sha256"}
        require(record.get("schema") == LANE.EVENT_SCHEMA and record.get("sequence") == index and record.get("previousSha256") == previous_hash and LANE.digest(LANE.canonical(unhashed)) == claimed, "Public event hash-chain verification failed")
        monotonic = record.get("monotonicNs")
        require(isinstance(monotonic, int) and monotonic >= previous_time, "Public events are not monotonic")
        timestamp(record.get("at"))
        require(isinstance(record.get("kind"), str), "Public event kind is invalid")
        require(isinstance(record.get("payload"), dict), "Public event payload is invalid")
        previous_hash, previous_time = claimed, monotonic
        events.append(record)
    require(events and events[0]["kind"] == "author-start" and events[-1]["kind"] == "author-finish", "A complete author-start to author-finish stream is required")
    return events, raw


def file_pin(data):
    return {"bytes": len(data), "sha256": LANE.digest(data)}


def relative_source_path(value):
    require(isinstance(value, str) and value and not Path(value).is_absolute() and ".." not in Path(value).parts and Path(value).as_posix() == value, "Source manifest path is unsafe")
    require(not any(part in ("node_modules", ".git") for part in Path(value).parts), "Excluded dependency/provider directories cannot appear in source manifests")
    return Path(value)


def verify_public(root, lane_id, lane, config):
    start = read_json(root / "start.json")
    finish = read_json(root / "finish.json")
    state = read_json(root / "state.json", immutable=False)
    events, events_raw = read_events(root)
    require(all(isinstance(record, dict) for record in (start, finish, state)), "Author manifests must be JSON objects")
    require(start.get("schema") == LANE.EVENT_SCHEMA and finish.get("schema") == LANE.EVENT_SCHEMA, "Author manifest schema differs")
    for record in (start, finish, state):
        require(record.get("lane") == lane_id and record.get("engine") == lane["engine"], "Author manifest belongs to a different lane or engine")
    require(state.get("finishedAt") == finish.get("finishedAt") and not state.get("activeCommand"), "Recorder state is not finished and quiescent")
    require(start.get("configurationSha256") == config["_fingerprint"] == state.get("configurationSha256"), "Private configuration fingerprint changed after author start")
    require(start.get("workspaceIdentity") == state.get("workspaceIdentity") == LANE.path_identity(Path(lane["workspace"])), "Author workspace identity changed")
    require(start.get("containerId") == state.get("containerId") and re.fullmatch(r"[a-f0-9]{64}", start.get("containerId", "")), "Pinned container identity differs")
    started = start.get("startedMonotonicNs")
    finished = finish.get("finishedMonotonicNs")
    require(isinstance(started, int) and isinstance(finished, int) and finished >= started, "Author start/finish times are invalid")
    require(state.get("startedMonotonicNs") == started and state.get("startedAt") == start.get("startedAt") == finish.get("startedAt"), "Author start timestamp was changed")
    timestamp(start["startedAt"])
    timestamp(finish["finishedAt"])
    require(start.get("budgetSeconds") == state.get("budgetSeconds") == lane["budgetSeconds"], "Author budget differs")
    initial_deadline = started + int(lane["budgetSeconds"] * 1e9)
    require(start.get("deadlineMonotonicNs") == initial_deadline and start.get("previewWaitNs", 0) == 0 and start.get("previews") == 0, "Initial author budget/counters are invalid")
    prompt = read_regular(root / "prompt.txt")
    reference = read_regular(root / "reference.png")
    require(start.get("prompt") == file_pin(prompt) and start.get("reference") == file_pin(reference), "Pinned public prompt/reference bytes differ")
    first = events[0]
    require(first["monotonicNs"] >= started and first["payload"] == {"engine": lane["engine"], "budgetSeconds": lane["budgetSeconds"], "promptSha256": LANE.digest(prompt), "referenceSha256": LANE.digest(reference), "containerId": start["containerId"]}, "Author-start event does not match the pinned manifests")

    commands = []
    previews = []
    feedback_reads = 0
    active = None
    pending_preview = None
    waited_ns = 0
    files_to_copy = {Path(name): root / name for name in ("start.json", "finish.json", "state.json", "events.jsonl", "prompt.txt", "reference.png")}
    command_ids = set()
    transcript = []
    for event in events[1:]:
        kind, payload, event_time = event["kind"], event["payload"], event["monotonicNs"]
        require(event_time >= started, "Event predates the author start")
        require(kind == "author-finish" or event_time <= finished, "An author operation occurs after the claimed finish timestamp")
        if kind == "author-note":
            require(active is None and pending_preview is None and isinstance(payload.get("text"), str), "Public note overlaps an active author operation")
            transcript.append({"kind": "note", "at": event["at"], "text": payload["text"]})
        elif kind == "command-start":
            require(active is None and pending_preview is None, "Author commands overlap")
            token = payload.get("commandId")
            require(isinstance(token, str) and re.fullmatch(r"[a-f0-9]{32}", token) and token not in command_ids, "Author command identity is invalid or duplicated")
            command_ids.add(token)
            directory = root / "commands" / token
            require(directory.resolve() == directory and directory.is_dir(), "Command directory identity differs")
            require({file.name for file in directory.iterdir()} == {"request.json", "result.json", "stdout.bin", "stderr.bin"}, "Command file inventory differs")
            request = read_json(directory / "request.json")
            require(request == payload, "Recorded command-start payload differs from request.json")
            require(request.get("cwd") == "/work" and request.get("containerId") == start["containerId"] and request.get("supervisorSha256") == LANE.digest(LANE.SUPERVISOR.encode()), "Command transport or container identity differs")
            require(isinstance(request.get("script"), str) and "\x00" not in request["script"], "Public command text is invalid")
            requested = request.get("startedMonotonicNs")
            require(isinstance(requested, int) and started <= requested <= event_time and requested < initial_deadline + waited_ns, "Command started outside its active author budget")
            deadline = request.get("deadlineSeconds")
            require(finite(deadline) and 0 < deadline <= lane["commandDeadlineSeconds"], "Command deadline exceeds its configured cap")
            # The recorder computes remaining budget immediately before creating
            # request.json; retain the measured bookkeeping slack explicitly.
            slack = max(0, requested + round(deadline * 1e9) - initial_deadline - waited_ns) / 1e9
            require(slack <= 1, "Command deadline exceeds remaining budget beyond recorder bookkeeping")
            timestamp(request.get("startedAt"))
            active = {"token": token, "directory": directory, "request": request, "deadlineBookkeepingSlackSeconds": slack}
        elif kind == "command-finish":
            require(active is not None and payload.get("commandId") == active["token"], "Command finish has no matching start")
            directory, request = active["directory"], active["request"]
            result = read_json(directory / "result.json")
            require(result == payload, "Recorded command-finish payload differs from result.json")
            require(isinstance(result.get("supervision"), dict), "Command supervision record is invalid")
            ended = result.get("finishedMonotonicNs")
            require(isinstance(ended, int) and request["startedMonotonicNs"] <= ended <= event_time, "Command finish timestamp is invalid")
            timestamp(result.get("finishedAt"))
            require(result.get("exitCode") is None or isinstance(result["exitCode"], int), "Command exit code is invalid")
            outputs = {}
            for stream in ("stdout", "stderr"):
                outputs[stream] = read_regular(directory / (stream + ".bin"))
                require(result.get(stream) == file_pin(outputs[stream]), "Actual command " + stream + " bytes differ from their hash/size record")
            for name in ("request.json", "result.json", "stdout.bin", "stderr.bin"):
                files_to_copy[Path("commands") / active["token"] / name] = directory / name
            commands.append({"commandId": active["token"], "scriptSha256": LANE.digest(request["script"].encode()), "startedAt": request["startedAt"], "finishedAt": result["finishedAt"], "durationSeconds": (ended - request["startedMonotonicNs"]) / 1e9, "exitCode": result.get("exitCode"), "timedOut": result.get("supervision", {}).get("timedOut", False), "transportError": result.get("transportError"), "supervisionAvailable": not result.get("supervision", {}).get("unavailable", False), "remainingDescendantPids": result.get("supervision", {}).get("remainingDescendantPids", []), "deadlineBookkeepingSlackSeconds": active["deadlineBookkeepingSlackSeconds"], "stdout": result["stdout"], "stderr": result["stderr"]})
            transcript.append({"kind": "command", "request": request, "result": result, "stdout": outputs["stdout"], "stderr": outputs["stderr"]})
            active = None
        elif kind == "preview-request":
            require(active is None and pending_preview is None, "Preview overlaps another author operation")
            number = len(previews) + 1
            require(number <= LANE.MAX_PREVIEWS and payload.get("number") == number and payload.get("lane") == lane_id and payload.get("engine") == lane["engine"], "Preview request counter or lane differs")
            preview_root = root / "previews"
            request_path = preview_root / f"{number:02d}-request.json"
            request = read_json(request_path)
            require(request == payload and request.get("schema") == "aperture.author-preview-request.v1", "Preview request payload differs")
            require(request.get("replyPath") == str(preview_root / f"{number:02d}-result.json") and request.get("artifactRoot") == str(preview_root / f"{number:02d}-artifacts"), "Preview paths differ from the lane-owned request paths")
            if lane.get("previewProtocol") == LANE.FROZEN_PREVIEW_PROTOCOL:
                manifest = LANE.validate_frozen_preview(request, request_path, lane)
                manifest_path = Path(request["frozenBuildManifest"]["path"])
                files_to_copy[manifest_path.relative_to(root)] = manifest_path
                for pin in manifest["files"]:
                    frozen_file = Path(request["appRoot"]) / pin["path"]
                    files_to_copy[frozen_file.relative_to(root)] = frozen_file
            else:
                require("previewProtocol" not in request and request.get("appRoot") == str(Path(lane["workspace"]) / lane.get("buildDirectory", "dist")), "Legacy preview build path/protocol differs")
            require(isinstance(request.get("requestedMonotonicNs"), int) and started <= request["requestedMonotonicNs"] <= event_time and request["requestedMonotonicNs"] < initial_deadline + waited_ns, "Preview request started outside the author budget")
            timestamp(request.get("requestedAt"))
            files_to_copy[request_path.relative_to(root)] = request_path
            pending_preview = {"request": request, "requestSha256": LANE.digest(read_regular(request_path))}
        elif kind == "preview-wait-finish":
            require(pending_preview is not None and payload.get("number") == pending_preview["request"]["number"], "Preview wait has no matching request")
            wait = payload.get("waitSeconds")
            credit = payload.get("budgetCreditSeconds")
            require(finite(wait) and 0 <= wait <= LANE.PREVIEW_WAIT_SECONDS + 5 and credit == wait, "Preview wait/budget credit is invalid")
            wait_ns = round(wait * 1e9)
            require(wait_ns <= event_time - pending_preview["request"]["requestedMonotonicNs"], "Preview wait exceeds its monotonic event interval")
            status = payload.get("status")
            require(status in ("ok", "error", "timeout", "invalid-response"), "Preview wait status is invalid")
            result_path = Path(pending_preview["request"]["replyPath"])
            if status in ("ok", "error"):
                result, result_hash = LANE.validate_preview_result(result_path, {**pending_preview["request"], "_requestSha256": pending_preview["requestSha256"]})
                require(payload.get("resultSha256") == result_hash and result.get("status") == status, "Preview response differs from the hash-chained wait result")
                files_to_copy[result_path.relative_to(root)] = result_path
                for value in [*result["capturePaths"], *([result["errorPath"]] if "errorPath" in result else [])]:
                    artifact = Path(value)
                    files_to_copy[artifact.relative_to(root)] = artifact
            else:
                require(payload.get("resultSha256") is None, "Unsuccessful unverified preview cannot claim a verified response hash")
            waited_ns += wait_ns
            previews.append({"number": payload["number"], "status": status, "waitSeconds": wait, "resultSha256": payload.get("resultSha256"), "lateReplyPresent": status in ("timeout", "invalid-response") and result_path.exists()})
            transcript.append({"kind": "preview", "request": pending_preview["request"], "result": payload})
            pending_preview = None
        elif kind == "preview-feedback-read":
            number = payload.get("number")
            require(active is None and pending_preview is None and isinstance(number, int) and 1 <= number <= len(previews), "Feedback has no completed matching preview request")
            request_path = root / "previews" / f"{number:02d}-request.json"
            request = read_json(request_path)
            result_path = Path(request["replyPath"])
            result, result_hash = LANE.validate_preview_result(result_path, {**request, "_requestSha256": LANE.digest(read_regular(request_path))})
            require(payload.get("resultSha256") == result_hash, "Feedback result hash differs from the published own response")
            artifacts = []
            error_prefix = b""
            error_size = 0
            files_to_copy[result_path.relative_to(root)] = result_path
            for value in [*result["capturePaths"], *([result["errorPath"]] if "errorPath" in result else [])]:
                artifact = Path(value)
                data = read_regular(artifact, immutable=False)
                artifacts.append({"path": value, **file_pin(data)})
                files_to_copy[artifact.relative_to(root)] = artifact
                if value == result.get("errorPath"):
                    error_prefix, error_size = data[:LANE.MAX_INLINE_ERROR_BYTES], len(data)
            require(payload.get("artifacts") == artifacts and payload.get("inlinePublicErrorTextBytes") == len(error_prefix) and payload.get("inlinePublicErrorTextTruncated") == (error_size > len(error_prefix)), "Feedback artifact hashes or inline diagnostic bounds differ")
            feedback_reads += 1
            transcript.append({"kind": "feedback", "number": number, "status": result["status"], "error": error_prefix})
        elif kind == "author-finish":
            require(event is events[-1] and active is None and pending_preview is None, "Author-finish is not the final quiescent operation")
            require(finished <= event_time and payload.get("finishSha256") == LANE.digest(LANE.canonical(finish)) and payload.get("files") == len(finish.get("files", [])), "Author-finish event differs from finish.json")
            close_seconds(payload.get("elapsedSeconds"), (finished - started) / 1e9, "Author-finish elapsed time")
        else:
            raise LANE.LaneError("Unexpected public event kind")
    require(active is None and pending_preview is None, "Author operation remains incomplete")
    actual_commands = {path.name for path in (root / "commands").iterdir()} if (root / "commands").exists() else set()
    require(actual_commands == command_ids, "Unrecorded or missing command directory found")
    require(state.get("previews") == finish.get("previewsRequested") == len(previews) and state.get("previewWaitNs") == waited_ns, "Final preview counters differ from the public event stream")
    require(state.get("deadlineMonotonicNs") == initial_deadline + waited_ns, "Final budget deadline differs from verified preview wait credit")
    close_seconds(finish.get("elapsedSeconds"), (finished - started) / 1e9, "Raw author elapsed time")
    close_seconds(finish.get("previewWaitSeconds"), waited_ns / 1e9, "Author preview wait time")
    close_seconds(finish.get("activeBudgetElapsedSeconds"), (finished - started - waited_ns) / 1e9, "Active author budget time")
    require(finish.get("runningProcesses") == [], "Finish manifest did not establish an idle author container")
    snapshots = finish.get("files")
    require(isinstance(snapshots, list), "Source manifest file list is invalid")
    seen = set()
    for pin in snapshots:
        require(isinstance(pin, dict), "Source manifest pin is invalid")
        path = relative_source_path(pin.get("path"))
        require(path not in seen and isinstance(pin.get("bytes"), int) and pin["bytes"] >= 0 and re.fullmatch(r"[a-f0-9]{64}", pin.get("sha256", "")), "Source manifest pin is invalid or duplicated")
        seen.add(path)
    require(finish.get("sourceExclusions") == ["node_modules", ".git"], "Source manifest exclusions differ")
    require(LANE.source_snapshot(Path(lane["workspace"])) == snapshots, "Current source/build bytes differ from the finished source manifest")

    occurrences = Counter(command["scriptSha256"] for command in commands)
    previous_exit = {}
    retries_after_failure = 0
    for command in commands:
        script_hash = command["scriptSha256"]
        if script_hash in previous_exit and previous_exit[script_hash] != 0:
            retries_after_failure += 1
        previous_exit[script_hash] = command["exitCode"]
    summary = {"schema": SCHEMA, "status": "verified", "auditedAt": LANE.utc_now(), "lane": lane_id, "engine": lane["engine"], "publicTranscriptScope": "Recorded commands, exact stdout/stderr bytes, public notes and preview requests only; no private model/provider sessions", "isolationScope": "Docker scene filesystem plus cooperative host-tool routing; host tool permissions are not adversarial confinement", "startedAt": start["startedAt"], "finishedAt": finish["finishedAt"], "elapsedSeconds": finish["elapsedSeconds"], "previewWaitSeconds": finish["previewWaitSeconds"], "activeBudgetElapsedSeconds": finish["activeBudgetElapsedSeconds"], "budgetSeconds": lane["budgetSeconds"], "finishAfterBudgetExpiry": finish["activeBudgetElapsedSeconds"] > lane["budgetSeconds"], "eventCount": len(events), "eventHeadSha256": events[-1]["sha256"], "eventsSha256": LANE.digest(events_raw), "startSha256": LANE.digest(read_regular(root / "start.json")), "finishSha256": LANE.digest(read_regular(root / "finish.json")), "promptSha256": LANE.digest(prompt), "referenceSha256": LANE.digest(reference), "configurationSha256": config["_fingerprint"], "sourceFileCount": len(snapshots), "sourceBytes": sum(pin["bytes"] for pin in snapshots), "commandCount": len(commands), "failedCommandCount": sum(command["exitCode"] != 0 for command in commands), "timedOutCommandCount": sum(command["timedOut"] for command in commands), "transportErrorCount": sum(bool(command["transportError"]) for command in commands), "unverifiedSupervisionCount": sum(not command["supervisionAvailable"] for command in commands), "commandsWithSurvivingDescendants": sum(bool(command["remainingDescendantPids"]) for command in commands), "totalCommandSeconds": sum(command["durationSeconds"] for command in commands), "repeatedExactCommandCount": sum(count - 1 for count in occurrences.values()), "sameExactCommandRetriesAfterFailure": retries_after_failure, "retryDefinition": "A retry is only a repeated identical shell-script hash whose preceding identical invocation exited unsuccessfully; other repair attempts are not inferred", "commands": commands, "previews": previews, "sourceFiles": snapshots}
    summary["feedbackReadCount"] = feedback_reads
    return summary, transcript, files_to_copy


def fenced(text, language=""):
    runs = [len(match.group()) for match in re.finditer(r"`+", text)]
    fence = "`" * max(3, max(runs, default=0) + 1)
    return fence + language + "\n" + text + ("" if text.endswith("\n") else "\n") + fence + "\n"


def render_transcript(summary, operations):
    parts = ["# Public operational transcript\n\n", f"Lane `{summary['lane']}` ({summary['engine']}). Raw wall time {summary['elapsedSeconds']:.3f}s; preview waiting {summary['previewWaitSeconds']:.3f}s; active budget time {summary['activeBudgetElapsedSeconds']:.3f}s.\n\n", f"{summary['commandCount']} commands, {summary['failedCommandCount']} unsuccessful exits, {summary['sameExactCommandRetriesAfterFailure']} identical-command retries after failure.\n\n", "This contains public tool operations only. Exact binary stdout/stderr survives beside each command record; text below decodes UTF-8 with non-UTF-8 bytes escaped and makes no inference about private model reasoning.\n\n"]
    for operation in operations:
        if operation["kind"] == "note":
            parts.extend([f"## Public note — {operation['at']}\n\n", fenced(operation["text"]), "\n"])
        elif operation["kind"] == "preview":
            result = operation["result"]
            parts.append(f"## Preview {result['number']}\n\nStatus: {result['status']}; recorder-measured coordinator wait: {result['waitSeconds']:.3f}s.\n\n")
        elif operation["kind"] == "feedback":
            parts.append(f"## Public preview {operation['number']} feedback\n\nStatus: {operation['status']}.\n\n")
            if operation["error"]:
                parts.extend([fenced(operation["error"].decode("utf-8", "backslashreplace"), "text"), "\n"])
        else:
            request, result = operation["request"], operation["result"]
            parts.extend([f"## Command {request['commandId']}\n\n", f"{request['startedAt']} → {result['finishedAt']}; exit {result['exitCode']}; duration {(result['finishedMonotonicNs'] - request['startedMonotonicNs']) / 1e9:.3f}s.\n\n", "Command:\n\n", fenced(request["script"], "sh"), "\nStdout:\n\n", fenced(operation["stdout"].decode("utf-8", "backslashreplace"), "text"), "\nStderr:\n\n", fenced(operation["stderr"].decode("utf-8", "backslashreplace"), "text"), "\n"])
    return "".join(parts).encode()


def finalize(lane_id, output, *, config_path=LANE.CONFIG):
    require(isinstance(lane_id, str) and LANE.LANE_PATTERN.fullmatch(lane_id), "Invalid author lane ID")
    config = LANE.load_config(config_path)
    require(lane_id in config["lanes"], "Unknown author lane")
    lane = config["lanes"][lane_id]
    root = Path(config["transcriptRoot"]) / lane_id
    output = LANE.checked_path(str(output))
    require(not LANE.within(output, Path(config["transcriptRoot"])) and not LANE.within(Path(config["transcriptRoot"]), output), "New audits must be outside existing recorder evidence")
    for configured in config["lanes"].values():
        workspace = Path(configured["workspace"])
        require(not LANE.within(output, workspace) and not LANE.within(workspace, output), "New audits must be outside both author workspaces")
    require(not LANE.within(output, config_path.parent), "New audits must be outside private control")
    output.parent.mkdir(parents=True, exist_ok=True)
    output.mkdir()  # Deliberately refuses retries that would overwrite evidence.
    try:
        with open(root / ".lane.lock", "rb") as lock:
            try:
                fcntl.flock(lock.fileno(), fcntl.LOCK_SH | fcntl.LOCK_NB)
            except BlockingIOError as error:
                raise LANE.LaneError("Author lane is still running; audit is refused") from error
            summary, operations, records = verify_public(root, lane_id, lane, config)
            retained_pins = {}
            for pin in summary["sourceFiles"]:
                relative = relative_source_path(pin["path"])
                data = read_regular(Path(lane["workspace"]) / relative, immutable=False)
                require(file_pin(data) == {"bytes": pin["bytes"], "sha256": pin["sha256"]}, "Source changed during immutable retention")
                target = Path("source") / relative
                LANE.write_immutable(output / target, data)
                retained_pins[target.as_posix()] = file_pin(data)
            for relative, source in sorted(records.items()):
                data = read_regular(source, immutable=relative.parts[0] not in ("events.jsonl", "state.json", "previews"))
                target = Path("public-records") / relative
                LANE.write_immutable(output / target, data)
                retained_pins[target.as_posix()] = file_pin(data)
            require(LANE.source_snapshot(Path(lane["workspace"])) == summary["sourceFiles"], "Source changed after immutable retention")
            require(LANE.digest(read_regular(root / "events.jsonl", immutable=False)) == summary["eventsSha256"], "Recorder evidence changed during audit")
            transcript = render_transcript(summary, operations)
            LANE.write_immutable(output / "transcript.md", transcript)
            retained_pins["transcript.md"] = file_pin(transcript)
            for relative, pin in retained_pins.items():
                require(file_pin(read_regular(output / relative)) == pin, "Retained copy bytes differ from the audited inputs")
            summary["retainedFiles"] = retained_pins
            summary["retainedSourceRoot"] = str(output / "source")
            summary["retainedBuiltAppRoot"] = str(output / "source" / lane.get("buildDirectory", "dist"))
            summary["verificationChecks"] = {"publicEventHashChain": True, "commandRecordAndOutputParity": True, "publicPromptAndReferencePins": True, "monotonicBudgetWaitAccounting": True, "finishedWorkspaceSourceHashes": True, "retainedCopiesReadBack": True}
            LANE.write_json(output / "audit.json", summary)
            return summary
    except (LANE.LaneError, ValueError, OSError, TypeError, KeyError) as error:
        LANE.write_json(output / "audit-failure.json", {"schema": SCHEMA, "auditedAt": LANE.utc_now(), "lane": lane_id, "status": "failed", "diagnostic": str(error), "existingInputsModified": False})
        raise


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("lane")
    parser.add_argument("--output", required=True)
    args = parser.parse_args(argv)
    try:
        summary = finalize(args.lane, Path(args.output))
        print(json.dumps({key: summary[key] for key in ("lane", "engine", "elapsedSeconds", "previewWaitSeconds", "activeBudgetElapsedSeconds", "commandCount", "failedCommandCount", "sameExactCommandRetriesAfterFailure", "retainedBuiltAppRoot")}))
        return 0
    except (LANE.LaneError, ValueError, OSError, TypeError, KeyError) as error:
        print("Author audit refused: " + str(error), file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
