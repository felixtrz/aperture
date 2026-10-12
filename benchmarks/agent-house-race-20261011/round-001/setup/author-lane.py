#!/usr/bin/env python3
"""Public, host-owned operational transcripts for cooperating isolated authors.

This records tool-visible operations, never private model reasoning or provider
session files. Docker constrains the scene process filesystem; routing an agent's
host tools through this helper is a cooperative rule, not an adversarial sandbox.
"""

from __future__ import annotations

import argparse
import datetime as dt
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import signal
import subprocess
import sys
import time
import uuid


ROOT = Path(__file__).resolve().parents[2]
CONFIG = ROOT / ".aperture-env/agent-house-race/control/lanes.json"
SCHEMA = "aperture.author-lanes.v1"
EVENT_SCHEMA = "aperture.author-transcript.v1"
MAX_PREVIEWS = 3
PREVIEW_WAIT_SECONDS = 300
MAX_SCRIPT_BYTES = 1024 * 1024
LANE_PATTERN = re.compile(r"^[a-z][a-z0-9-]{0,47}$")
CONTAINER_PATTERN = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$")


class LaneError(Exception):
    pass


def require(value, message):
    if not value:
        raise LaneError(message)


def utc_now():
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="microseconds")


def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")


def digest(data):
    return hashlib.sha256(data).hexdigest()


def within(path, parent):
    return path == parent or parent in path.parents


def checked_path(value, *, directory=False):
    require(isinstance(value, str) and Path(value).is_absolute(), "Configured paths must be absolute")
    path = Path(value)
    require(path.resolve() == path, "Configured paths must be canonical and contain no symlinks")
    if directory:
        require(path.is_dir(), "Configured directory is missing")
    return path


def path_identity(path):
    stat = path.stat()
    return {"device": stat.st_dev, "inode": stat.st_ino}


def load_config(path=CONFIG):
    raw = path.read_bytes()
    config = json.loads(raw)
    require(isinstance(config, dict) and config.get("schema") == SCHEMA, "Author lane configuration schema differs")
    transcript_root = checked_path(config.get("transcriptRoot"))
    require(not within(transcript_root, path.parent), "Transcripts cannot share the private configuration directory")
    lanes = config.get("lanes")
    require(isinstance(lanes, dict) and len(lanes) == 2, "Exactly two configured author lanes are required")
    workspaces = []
    engines = []
    mounts = []
    names = []
    for name, lane in lanes.items():
        require(LANE_PATTERN.fullmatch(name), "Invalid author lane ID")
        require(isinstance(lane, dict), "Invalid author lane configuration")
        require(lane.get("engine") in ("three", "aperture"), "Invalid assigned engine")
        engines.append(lane["engine"])
        container = lane.get("container")
        require(isinstance(container, str) and CONTAINER_PATTERN.fullmatch(container), "Invalid configured container name")
        names.append(container)
        workspace = checked_path(lane.get("workspace"), directory=True)
        require(workspace != ROOT and not within(ROOT, workspace), "Parent repository cannot be mounted")
        require(not within(path.parent, workspace) and not within(workspace, path.parent), "Private control directory cannot be mounted")
        workspaces.append(workspace)
        mounts.append(workspace)
        for key in ("budgetSeconds", "commandDeadlineSeconds"):
            value = lane.get(key)
            require(isinstance(value, (int, float)) and not isinstance(value, bool) and 10 <= value <= 14400, "Author deadlines must be between 10 seconds and four hours")
        require(lane["commandDeadlineSeconds"] <= lane["budgetSeconds"], "Command deadline exceeds author budget")
        for key in ("promptPath", "referencePath"):
            require(checked_path(lane.get(key)).is_file(), "Public prompt/reference is missing")
        read_only = lane.get("readOnlyMounts", [])
        require(isinstance(read_only, list), "Read-only mount list is invalid")
        targets = {"/work"}
        for mount in read_only:
            require(isinstance(mount, dict), "Read-only mount entry is invalid")
            source = checked_path(mount.get("source"))
            require(source.exists(), "Read-only mount source is missing")
            require(source != ROOT and not within(ROOT, source), "Parent repository cannot be mounted")
            require(not within(path.parent, source) and not within(source, path.parent), "Private control directory cannot be mounted")
            target = mount.get("target")
            require(isinstance(target, str) and target.startswith("/") and str(Path(target)) == target, "Mount target must be canonical and absolute")
            require(target not in targets and not within(Path(target), Path("/work")) and not within(Path("/work"), Path(target)), "Mount targets must not overlap the writable workspace")
            require("docker.sock" not in target and "docker.sock" not in str(source), "Docker socket mounts are forbidden")
            targets.add(target)
            mounts.append(source)
        build = lane.get("buildDirectory", "dist")
        require(isinstance(build, str) and build and not Path(build).is_absolute() and ".." not in Path(build).parts, "Build directory must remain inside /work")
    require(set(engines) == {"three", "aperture"} and len(set(names)) == 2, "Each engine needs a distinct container")
    require(not any(within(a, b) for i, a in enumerate(workspaces) for j, b in enumerate(workspaces) if i != j), "Private lane workspaces cannot overlap")
    for mount in mounts:
        require(not within(transcript_root, mount) and not within(mount, transcript_root), "Public evidence must be outside every container mount")
    for name, lane in lanes.items():
        own = Path(lane["workspace"])
        for mount in lane.get("readOnlyMounts", []):
            source = Path(mount["source"])
            require(not any(other != own and (within(source, other) or within(other, source)) for other in workspaces), "One lane cannot mount the other lane")
    config["_fingerprint"] = digest(raw)
    return config


def docker(args, *, timeout=30):
    try:
        result = subprocess.run(["docker", *args], capture_output=True, timeout=timeout, check=False)
    except (OSError, subprocess.TimeoutExpired) as error:
        raise LaneError("Docker control operation did not complete") from error
    require(result.returncode == 0, "Docker control operation failed; no configuration or environment was printed")
    return result.stdout


def validate_container(info, lane):
    require(info.get("Name") == "/" + lane["container"], "Configured container name differs")
    require(re.fullmatch(r"[a-f0-9]{64}", info.get("Id", "")), "Container identity is invalid")
    require(info.get("State", {}).get("Running") is True, "Author container is not running")
    host = info.get("HostConfig", {})
    require(not host.get("Privileged") and host.get("PidMode", "") != "host" and host.get("NetworkMode") != "host", "Author container cannot use host privileges, PID or network namespaces")
    expected = {(str(Path(lane["workspace"])), "/work", True)}
    expected.update((mount["source"], mount["target"], False) for mount in lane.get("readOnlyMounts", []))
    actual = set()
    for mount in info.get("Mounts", []):
        require(mount.get("Type") == "bind", "Only explicitly configured bind mounts are permitted")
        actual.add((mount.get("Source"), mount.get("Destination"), mount.get("RW")))
    require(actual == expected and len(info.get("Mounts", [])) == len(expected), "Author container mounts differ from the private lane configuration")
    require(info.get("Config", {}).get("WorkingDir") == "/work", "Author container must declare /work as its working directory")
    return info["Id"]


def inspect_container(lane):
    result = json.loads(docker(["inspect", "--type", "container", lane["container"]]))
    require(isinstance(result, list) and len(result) == 1, "Exactly one configured container must be inspected")
    return validate_container(result[0], lane)


def write_immutable(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "xb") as file:
        file.write(data)
        file.flush()
        os.fsync(file.fileno())
        os.fchmod(file.fileno(), 0o444)


def write_json(path, value):
    write_immutable(path, canonical(value) + b"\n")


def store_state(root, state):
    temporary = root / (".state-" + uuid.uuid4().hex)
    with open(temporary, "xb") as file:
        file.write(canonical(state) + b"\n")
        file.flush()
        os.fsync(file.fileno())
    os.replace(temporary, root / "state.json")


def append_event(root, kind, payload):
    path = root / "events.jsonl"
    previous = "0" * 64
    sequence = 0
    if path.exists():
        for line in path.read_bytes().splitlines():
            record = json.loads(line)
            expected = record.pop("sha256")
            require(record.get("previousSha256") == previous and record.get("sequence") == sequence + 1 and digest(canonical(record)) == expected, "Public transcript hash chain is invalid")
            previous = expected
            sequence += 1
    record = {"schema": EVENT_SCHEMA, "sequence": sequence + 1, "previousSha256": previous, "at": utc_now(), "monotonicNs": time.monotonic_ns(), "kind": kind, "payload": payload}
    record["sha256"] = digest(canonical(record))
    with open(path, "ab") as file:
        file.write(canonical(record) + b"\n")
        file.flush()
        os.fsync(file.fileno())
    return record


# Linux child-subreaper supervision also catches daemonizing grandchildren.
# The public command is separate from this fixed transport implementation.
SUPERVISOR = r'''
import ctypes, json, os, signal, subprocess, sys, time
from pathlib import Path
script, deadline, token = sys.argv[1], float(sys.argv[2]), sys.argv[3]
root = Path('/tmp/aperture-author-command-' + token)
root.mkdir(mode=0o700)
libc = ctypes.CDLL(None, use_errno=True)
if libc.prctl(36, 1, 0, 0, 0) != 0:
    raise RuntimeError('Child subreaper unavailable')
(root / 'pid.json').write_text(json.dumps({'pid': os.getpid(), 'token': token}))
stopped = False
def stop(signum, frame):
    global stopped
    stopped = True
signal.signal(signal.SIGTERM, stop)
signal.signal(signal.SIGINT, stop)
started = time.monotonic()
child = subprocess.Popen(['/bin/sh', '-c', script], cwd='/work', start_new_session=True)
timed_out = False
while child.poll() is None:
    if stopped or time.monotonic() - started >= deadline:
        timed_out = not stopped
        break
    time.sleep(0.025)
def descendants():
    parents = {}
    for path in Path('/proc').glob('[0-9]*/stat'):
        try:
            text = path.read_text()
            parents[int(path.parent.name)] = int(text[text.rfind(')') + 2:].split()[1])
        except (FileNotFoundError, ProcessLookupError, ValueError, PermissionError):
            pass
    found, pending = set(), {os.getpid()}
    while pending:
        children = {pid for pid, parent in parents.items() if parent in pending and pid not in found}
        found.update(children)
        pending = children
    return found
killed = set()
for sig in (signal.SIGTERM, signal.SIGKILL):
    until = time.monotonic() + 1
    while True:
        targets = descendants()
        for pid in targets:
            try:
                os.kill(pid, sig)
                killed.add(pid)
            except ProcessLookupError:
                pass
        while True:
            try:
                pid, status = os.waitpid(-1, os.WNOHANG)
                if not pid: break
                if pid == child.pid and child.returncode is None:
                    child.returncode = os.waitstatus_to_exitcode(status)
            except ChildProcessError:
                break
        if not descendants() or time.monotonic() >= until:
            break
        time.sleep(0.025)
try:
    code = child.wait(timeout=1)
except ChildProcessError:
    code = child.returncode
remaining = sorted(descendants())
result = {'shellExitCode': code, 'timedOut': timed_out, 'interrupted': stopped,
          'terminatedDescendantPids': sorted(killed), 'remainingDescendantPids': remaining}
(root / 'result.json').write_text(json.dumps(result))
sys.exit(125 if remaining else 124 if timed_out else 130 if stopped else code if code is not None and code >= 0 else 128 + abs(code or 0))
'''


def stop_remote(container, token):
    code = "import json,os,signal,sys; p=json.load(open('/tmp/aperture-author-command-'+sys.argv[1]+'/pid.json')); assert p['token']==sys.argv[1]; os.kill(p['pid'],signal.SIGTERM)"
    try:
        docker(["exec", "--workdir", "/work", container, "python3", "-c", code, token], timeout=10)
    except LaneError:
        pass


def read_remote_result(container, token):
    code = "import pathlib,sys; sys.stdout.buffer.write(pathlib.Path('/tmp/aperture-author-command-'+sys.argv[1]+'/result.json').read_bytes())"
    try:
        return json.loads(docker(["exec", "--workdir", "/work", container, "python3", "-c", code, token], timeout=10))
    except (LaneError, json.JSONDecodeError):
        return {"unavailable": True}


def running_processes(container):
    code = "import os,pathlib,json; out=[];\nfor p in pathlib.Path('/proc').glob('[0-9]*/stat'):\n try:\n  pid=int(p.parent.name); text=p.read_text(); fields=text[text.rfind(')')+2:].split();\n  if pid not in (1,os.getpid()): out.append({'pid':pid,'state':fields[0],'parent':int(fields[1])})\n except (FileNotFoundError,ProcessLookupError,PermissionError): pass\nprint(json.dumps(out))"
    return json.loads(docker(["exec", "--workdir", "/work", container, "python3", "-c", code], timeout=10))


def require_open(state, *, budget=True):
    require(state is not None, "Run start before any author operations")
    require(not state.get("finishedAt"), "Author lane is finished; further edits and requests are forbidden")
    require(not state.get("activeCommand"), "A previous command is incomplete; root must review its surviving transcript")
    if budget:
        require(time.monotonic_ns() < state["deadlineMonotonicNs"], "Author budget has expired; only finish remains available")


def execute(root, state, lane, script):
    require(isinstance(script, str) and len(script.encode("utf-8")) <= MAX_SCRIPT_BYTES and "\x00" not in script, "Public shell command is invalid or exceeds 1 MiB")
    require_open(state)
    remaining = (state["deadlineMonotonicNs"] - time.monotonic_ns()) / 1e9
    deadline = min(lane["commandDeadlineSeconds"], remaining)
    token = uuid.uuid4().hex
    command = root / "commands" / token
    command.mkdir(parents=True)
    request = {"commandId": token, "script": script, "cwd": "/work", "containerId": state["containerId"], "startedAt": utc_now(), "startedMonotonicNs": time.monotonic_ns(), "deadlineSeconds": deadline, "supervisorSha256": digest(SUPERVISOR.encode())}
    write_json(command / "request.json", request)
    state["activeCommand"] = token
    store_state(root, state)
    append_event(root, "command-start", request)
    args = ["docker", "exec", "--workdir", "/work", state["containerId"], "python3", "-c", SUPERVISOR, script, str(deadline), token]
    transport_error = None
    exit_code = None
    process = None
    with open(command / "stdout.bin", "xb") as stdout, open(command / "stderr.bin", "xb") as stderr:
        try:
            process = subprocess.Popen(args, stdout=stdout, stderr=stderr, start_new_session=True)
            try:
                exit_code = process.wait(timeout=deadline + 15)
            except (subprocess.TimeoutExpired, KeyboardInterrupt) as error:
                transport_error = type(error).__name__
                stop_remote(state["containerId"], token)
                try:
                    exit_code = process.wait(timeout=15)
                except subprocess.TimeoutExpired:
                    os.killpg(process.pid, signal.SIGKILL)
                    exit_code = process.wait(timeout=10)
        except OSError as error:
            transport_error = type(error).__name__
        finally:
            for file in (stdout, stderr):
                file.flush()
                os.fsync(file.fileno())
                os.fchmod(file.fileno(), 0o444)
    result = {"commandId": token, "finishedAt": utc_now(), "finishedMonotonicNs": time.monotonic_ns(), "exitCode": exit_code, "transportError": transport_error, "supervision": read_remote_result(state["containerId"], token), "stdout": {"bytes": (command / "stdout.bin").stat().st_size, "sha256": digest((command / "stdout.bin").read_bytes())}, "stderr": {"bytes": (command / "stderr.bin").stat().st_size, "sha256": digest((command / "stderr.bin").read_bytes())}}
    write_json(command / "result.json", result)
    append_event(root, "command-finish", result)
    del state["activeCommand"]
    store_state(root, state)
    # Return actual public output with both streams intact. Surviving byte files
    # remain authoritative if the calling tool truncates its display.
    sys.stdout.buffer.write((command / "stdout.bin").read_bytes())
    sys.stdout.buffer.flush()
    sys.stderr.buffer.write((command / "stderr.bin").read_bytes())
    sys.stderr.buffer.flush()
    print(json.dumps({"transcriptCommand": str(command), "exitCode": exit_code, "supervision": result["supervision"]}), file=sys.stderr)
    return exit_code if isinstance(exit_code, int) and 0 <= exit_code <= 255 else 125


def source_snapshot(workspace):
    result = []
    for directory, directories, files in os.walk(workspace, followlinks=False):
        directories[:] = sorted(name for name in directories if name not in ("node_modules", ".git"))
        for name in directories + sorted(files):
            path = Path(directory) / name
            require(not path.is_symlink(), "Source snapshots reject symbolic links outside dependency directories")
        for name in sorted(files):
            path = Path(directory) / name
            require(path.is_file(), "Source snapshot contains a non-regular file")
            data = path.read_bytes()
            result.append({"path": path.relative_to(workspace).as_posix(), "bytes": len(data), "sha256": digest(data)})
    return result


def validate_preview_result(path, request):
    require(path.is_file() and not path.is_symlink(), "Coordinator preview result must be a regular file")
    require(path.stat().st_mode & 0o222 == 0, "Coordinator preview result must be immutable before publication")
    raw = path.read_bytes()
    require(len(raw) <= MAX_SCRIPT_BYTES, "Coordinator preview result exceeds 1 MiB")
    result = json.loads(raw)
    require(isinstance(result, dict) and result.get("schema") == "aperture.author-preview-result.v1", "Coordinator preview result schema differs")
    for key in ("lane", "engine", "number"):
        require(result.get(key) == request[key], "Coordinator preview result belongs to a different request")
    require(result.get("requestSha256") == request["_requestSha256"], "Coordinator preview result request hash differs")
    require(result.get("status") in ("ok", "error"), "Coordinator preview result status is invalid")
    completed = result.get("completedAt")
    require(isinstance(completed, str), "Coordinator preview result completion timestamp is missing")
    try:
        timestamp = dt.datetime.fromisoformat(completed.replace("Z", "+00:00"))
        require(timestamp.tzinfo is not None, "Coordinator completion timestamp must include timezone")
    except ValueError as error:
        raise LaneError("Coordinator completion timestamp is invalid") from error
    captures = result.get("capturePaths")
    require(isinstance(captures, list) and len(captures) <= 3 and all(isinstance(value, str) for value in captures), "Coordinator preview capture list is invalid")
    if result["status"] == "ok":
        require(len(captures) >= 1, "Successful preview must contain a surviving capture")
    else:
        require(isinstance(result.get("errorPath"), str), "Failed preview needs a surviving public error artifact")
    artifact_root = Path(request["artifactRoot"])
    for value in [*captures, *([result["errorPath"]] if "errorPath" in result else [])]:
        artifact = checked_path(value)
        require(within(artifact, artifact_root) and artifact.is_file() and not artifact.is_symlink(), "Preview artifacts must belong only to this author's request")
    return result, digest(raw)


def wait_for_preview(root, state, request, reply_path):
    started = time.monotonic_ns()
    result = None
    result_hash = None
    status = "timeout"
    diagnostic = None
    try:
        deadline = started + int(PREVIEW_WAIT_SECONDS * 1e9)
        while time.monotonic_ns() < deadline:
            # The coordinator may create exclusively, write/fsync, then chmod.
            # A still-writable file is being published rather than ready to read.
            if reply_path.exists() and reply_path.stat().st_mode & 0o222 == 0:
                try:
                    result, result_hash = validate_preview_result(reply_path, request)
                    status = result["status"]
                except (LaneError, ValueError, OSError) as error:
                    status = "invalid-response"
                    diagnostic = str(error)
                break
            time.sleep(0.1)
    finally:
        waited = time.monotonic_ns() - started
        # This interval is measured by the recorder, capped by the same fixed
        # coordinator deadline for both engines, and survives in the public
        # chain even when no response arrives. Never subtract it from raw wall.
        state["previewWaitNs"] = state.get("previewWaitNs", 0) + waited
        state["deadlineMonotonicNs"] += waited
        append_event(root, "preview-wait-finish", {"number": request["number"], "status": status, "waitSeconds": waited / 1e9, "budgetCreditSeconds": waited / 1e9, "resultSha256": result_hash, "diagnostic": diagnostic})
        store_state(root, state)
    output = {"previewRequest": str(reply_path.with_name(f"{request['number']:02d}-request.json")), "status": status, "previewWaitSeconds": waited / 1e9, "capturePaths": result["capturePaths"] if result else []}
    if result and "errorPath" in result:
        output["errorPath"] = result["errorPath"]
    if diagnostic:
        output["diagnostic"] = diagnostic
    if status == "timeout":
        output["diagnostic"] = "Coordinator did not publish a result within the fixed 300 second preview deadline"
    print(json.dumps(output), flush=True)
    return 0 if status == "ok" else 3


def run(lane_id, action, text=None, *, config_path=CONFIG):
    require(isinstance(lane_id, str) and LANE_PATTERN.fullmatch(lane_id), "Invalid author lane ID")
    config = load_config(config_path)
    require(lane_id in config["lanes"], "Unknown author lane")
    lane = config["lanes"][lane_id]
    root = Path(config["transcriptRoot"]) / lane_id
    root.mkdir(parents=True, exist_ok=True)
    require(root.resolve() == root, "Transcript directory identity differs")
    with open(root / ".lane.lock", "ab") as lock:
        try:
            fcntl.flock(lock.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError as error:
            raise LaneError("Another command is running for this author lane") from error
        state_path = root / "state.json"
        state = json.loads(state_path.read_bytes()) if state_path.exists() else None
        if state:
            require(state["configurationSha256"] == config["_fingerprint"], "Author configuration changed after start")
            require(state["workspaceIdentity"] == path_identity(Path(lane["workspace"])), "Author workspace directory was replaced")
        if action == "start":
            require(state is None, "Author start timestamp already exists and cannot be reset")
            container = inspect_container(lane)
            require(not running_processes(container), "Author container must be idle before the author starts")
            started = time.monotonic_ns()
            prompt = Path(lane["promptPath"]).read_bytes()
            reference = Path(lane["referencePath"]).read_bytes()
            write_immutable(root / "prompt.txt", prompt)
            write_immutable(root / "reference.png", reference)
            state = {"schema": EVENT_SCHEMA, "lane": lane_id, "engine": lane["engine"], "containerId": container, "configurationSha256": config["_fingerprint"], "workspaceIdentity": path_identity(Path(lane["workspace"])), "startedAt": utc_now(), "startedMonotonicNs": started, "deadlineMonotonicNs": started + int(lane["budgetSeconds"] * 1e9), "budgetSeconds": lane["budgetSeconds"], "previews": 0, "previewWaitNs": 0}
            write_json(root / "start.json", {**state, "prompt": {"bytes": len(prompt), "sha256": digest(prompt)}, "reference": {"bytes": len(reference), "sha256": digest(reference)}, "boundary": "Cooperative author tool routing; host tool permissions are not an adversarial confinement boundary"})
            append_event(root, "author-start", {"engine": lane["engine"], "budgetSeconds": lane["budgetSeconds"], "promptSha256": digest(prompt), "referenceSha256": digest(reference), "containerId": container})
            store_state(root, state)
            print(json.dumps({"startedAt": state["startedAt"], "budgetSeconds": lane["budgetSeconds"], "budgetAccounting": "All author wall time counts except recorder-verified waiting for up to three coordinator previews; raw elapsed wall time is retained separately", "onExpiry": "No further commands, notes or preview requests; finish remains available", "transcript": str(root)}))
            return 0
        require_open(state, budget=action != "finish")
        if action == "note":
            require(isinstance(text, str) and len(text.encode()) <= MAX_SCRIPT_BYTES, "Public note must be at most 1 MiB")
            append_event(root, "author-note", {"text": text})
            return 0
        container = inspect_container(lane)
        require(container == state["containerId"], "Author container was replaced after start")
        if action == "exec":
            require(not running_processes(container), "Author command requires an idle container; preceding work must be quiescent")
            return execute(root, state, lane, text)
        if action == "preview":
            require(state["previews"] < MAX_PREVIEWS, "At most three author previews are permitted")
            require(not running_processes(container), "Author preview requires an idle application container")
            number = state["previews"] + 1
            path = root / "previews" / f"{number:02d}-request.json"
            request = {"schema": "aperture.author-preview-request.v1", "lane": lane_id, "engine": lane["engine"], "number": number, "requestedAt": utc_now(), "requestedMonotonicNs": time.monotonic_ns(), "appRoot": str(Path(lane["workspace"]) / lane.get("buildDirectory", "dist")), "artifactRoot": str(path.with_name(f"{number:02d}-artifacts")), "route": "Root must use tools/agent-benchmark/run.mjs within an adopted runtime_pressure lifecycle; no author browser launches", "replyPath": str(path.with_name(f"{number:02d}-result.json"))}
            write_json(path, request)
            append_event(root, "preview-request", request)
            state["previews"] = number
            store_state(root, state)
            print(json.dumps({"previewRequest": str(path), "status": "pending-root-runner", "waitDeadlineSeconds": PREVIEW_WAIT_SECONDS}), flush=True)
            return wait_for_preview(root, state, {**request, "_requestSha256": digest(path.read_bytes())}, Path(request["replyPath"]))
        if action == "finish":
            processes = running_processes(container)
            require(not processes, "Author container has running processes; finish is refused")
            snapshot = source_snapshot(Path(lane["workspace"]))
            finished = time.monotonic_ns()
            result = {"schema": EVENT_SCHEMA, "lane": lane_id, "engine": lane["engine"], "finishedAt": utc_now(), "finishedMonotonicNs": finished, "startedAt": state["startedAt"], "elapsedSeconds": (finished - state["startedMonotonicNs"]) / 1e9, "previewWaitSeconds": state.get("previewWaitNs", 0) / 1e9, "activeBudgetElapsedSeconds": (finished - state["startedMonotonicNs"] - state.get("previewWaitNs", 0)) / 1e9, "runningProcesses": processes, "previewsRequested": state["previews"], "sourceExclusions": ["node_modules", ".git"], "files": snapshot}
            write_json(root / "finish.json", result)
            append_event(root, "author-finish", {"finishSha256": digest(canonical(result)), "elapsedSeconds": result["elapsedSeconds"], "files": len(snapshot)})
            state["finishedAt"] = result["finishedAt"]
            store_state(root, state)
            print(json.dumps({"finishedAt": result["finishedAt"], "elapsedSeconds": result["elapsedSeconds"], "previewWaitSeconds": result["previewWaitSeconds"], "activeBudgetElapsedSeconds": result["activeBudgetElapsedSeconds"], "sourceManifest": str(root / "finish.json")}))
            return 0
        raise LaneError("Unknown author operation")


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("lane")
    parser.add_argument("action", choices=("start", "note", "exec", "preview", "finish"))
    parser.add_argument("text", nargs="?")
    args = parser.parse_args(argv)
    if (args.action in ("note", "exec")) != (args.text is not None):
        parser.error("note/exec require exactly one text argument; other operations take no text")
    try:
        return run(args.lane, args.action, args.text)
    except (LaneError, ValueError, OSError) as error:
        print("Author lane refused: " + str(error), file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
