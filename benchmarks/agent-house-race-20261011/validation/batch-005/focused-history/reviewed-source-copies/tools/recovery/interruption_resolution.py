"""Explicit, pinned interruption evidence; never lifecycle completion or cleanup.

Only stat metadata is inspected. No process environments or command lines are read.
Callers must hold the exclusive lifecycle lock and the selected registration lock.
"""
import argparse
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import time

import cleanup as c

SCHEMA = "aperture.interruption-resolution.v1"
AUTH_SCHEMA = "aperture.interruption-resolution-authorization.v1"
REVIEW_SCHEMA = "aperture.root-reviewed-interruption-observation.v1"
MAX_PROCESSES = 65536
MAX_RECEIPTS = 64


def pin(path):
    with c.PinnedDirectory(str(Path(path).parent)) as parent:
        raw, st, sha = c.read_file(parent.fd, Path(path).name, c.MAX_JSON)
        parent.verify()
    return {"path": str(path), "bytes": st.st_size, "sha256": sha}


def read_pin(record, immutable=True):
    c.require(isinstance(record, dict) and set(record) == {"path", "bytes", "sha256"}, "Exact file pin required")
    path = Path(record["path"])
    c.require(path.is_absolute() and path.resolve(strict=True) == path, "Canonical pinned input required")
    with c.PinnedDirectory(str(path.parent)) as parent:
        raw, st, sha = c.read_file(parent.fd, path.name, c.MAX_JSON)
        c.require((not immutable or not st.st_mode & 0o222) and len(raw) == record["bytes"] and sha == record["sha256"], "Readonly interruption pin differs")
        parent.verify()
    return raw


def decoded(raw):
    return json.loads(raw, object_pairs_hook=c.unique_pairs,
                      parse_constant=lambda _: (_ for _ in ()).throw(c.Unsafe("Nonfinite interruption input")))


def boot_id():
    value = Path("/proc/sys/kernel/random/boot_id").read_text().strip()
    c.require(re.fullmatch(r"[0-9a-f-]{36}", value), "Unknown boot identity")
    return value


def parse_stat(raw):
    end = raw.rfind(")")
    c.require(end > 0, "Malformed process stat")
    pid = int(raw[:raw.index(" (")])
    fields = raw[end + 2:].split()
    c.require(len(fields) >= 50, "Incomplete process stat")
    return {"pid": pid, "state": fields[0], "parentPid": int(fields[1]),
            "processGroup": int(fields[2]), "sessionId": int(fields[3]),
            "startTimeTicks": int(fields[19]), "rawExitStatus": int(fields[49])}


def process_metadata():
    result = []
    for path in Path("/proc").iterdir():
        if not path.name.isdigit():
            continue
        c.require(len(result) < MAX_PROCESSES, "Process metadata bound exceeded")
        try:
            result.append(parse_stat((path / "stat").read_text()))
        except FileNotFoundError:
            continue  # A disappeared process cannot be a live owned instance.
    return result


def process_closure(review):
    c.require(review["bootId"] == boot_id(), "Boot changed; new explicit review required")
    if review.get("interruptionKind") == "command-not-launched":
        missing = review["missingExecutable"]
        c.require(not os.path.lexists(missing), "Reviewed missing executable is now present; new review required")
        return {"managedCommandLaunched": False, "missingExecutable": missing,
                "missingExecutableObservedAbsent": True, "applicationPid": None,
                "zombiesReaped": False}
    ownership = decoded(read_pin(review["initialProcessOwnershipSnapshot"]))
    c.require(ownership.get("run") == review["run"] and isinstance(ownership.get("processes"), list) and 0 < len(ownership["processes"]) <= 256, "Bounded exact ownership snapshot required")
    known = ownership["processes"]
    c.require(all(item.get("exists") is True and all(type(item.get(key)) is int and item[key] > 0 for key in ("pid", "startTimeTicks", "processGroup", "sessionId")) for item in known), "Missing owned process identity")
    c.require(len({item["pid"] for item in known}) == len(known), "Duplicate owned process identity")
    sessions = {item["sessionId"] for item in known}
    c.require(set(review.get("ownedSessions", [])) == sessions, "Owned sessions differ from snapshot")
    current = process_metadata()
    by_pid = {item["pid"]: item for item in current}
    owned = {item["pid"] for item in current if item["sessionId"] in sessions}
    owned.update(item["pid"] for item in known if item["pid"] in by_pid and by_pid[item["pid"]]["startTimeTicks"] == item["startTimeTicks"])
    for _ in range(len(current) + 1):
        expanded = owned | {item["pid"] for item in current if item["parentPid"] in owned}
        if expanded == owned:
            break
        owned = expanded
    observed = [item for item in current if item["pid"] in owned]
    c.require(all(item["state"] == "Z" for item in observed), "Live owned session or descendant; interruption unresolved")
    # PID reuse is not treated as the old instance, and no reused process is signaled.
    return {"knownInstances": [{"identity": item, "observation": by_pid.get(item["pid"]),
             "sameInstance": item["pid"] in by_pid and by_pid[item["pid"]]["startTimeTicks"] == item["startTimeTicks"]} for item in known],
            "ownedExecutionEnded": observed, "zombiesReaped": False}


def no_launch_evidence(auth, review, manifest, events, store):
    c.require(auth.get("supervisorPids") == [] and auth.get("applicationPid") is None and auth.get("nativeApplication") is None, "No-command launch cannot claim an application or supervisor")
    c.require(review.get("supervisorPids") == [] and review.get("applicationPid") is None and review.get("applicationOutcome") is None and review.get("applicationKernelExitStatus") is None and review.get("managedCommandLaunched") is False and review.get("nativeLaunchAttempted") is False, "No-command review must retain absent application evidence")
    c.require(manifest["files"] == {} and len(events) == 2, "Only empty registered files and exact start/launch-error audit are supported")
    error = events[1]
    c.require(error.get("event") == "run-error" and error.get("phase") == "launch" and error.get("reason") == "FileNotFoundError" and error.get("completion_persisted") is False, "Only exact missing-command Popen launch failure can resolve")
    c.require(error.get("root") == store.cfg.root and error.get("run") == auth["run"] and type(error.get("at_ns")) is int and error["at_ns"] >= events[0]["at_ns"], "Launch-error audit root/run/time differs")
    graph = auth.get("launchEvidence")
    keys = {"command", "result", "stdout", "stderr", "cleanupSource", "runtimePressureSource"}
    c.require(isinstance(graph, dict) and set(graph) == keys and graph == review.get("launchEvidence"), "Exact root-reviewed no-launch records required")
    source_paths = {"cleanupSource": Path(c.__file__).resolve(), "runtimePressureSource": Path(c.__file__).resolve().with_name("runtime_pressure.py")}
    for key, path in source_paths.items():
        c.require(graph[key] == pin(path), "No-launch source/Popen branch differs")
        read_pin(graph[key], immutable=False)
    values = {key: read_pin(graph[key]) for key in ("command", "result", "stdout", "stderr")}
    command, result, stderr = (decoded(values[key]) for key in ("command", "result", "stderr"))
    argv, child = command.get("argv"), command.get("childArgv")
    c.require(isinstance(argv, list) and "--" in argv and isinstance(child, list) and child and all(isinstance(item, str) for item in child) and argv[argv.index("--") + 1:] == child == review.get("attemptedCommand"), "Recorded wrapper command suffix does not identify the failed command")
    c.require("--root" in argv and argv[argv.index("--root") + 1] == store.cfg.root and "--job" in argv and argv[argv.index("--job") + 1] == manifest["job"], "Recorded wrapper root/job differs")
    cwd = Path(command.get("cwd", ""))
    c.require(cwd.is_absolute() and cwd.resolve(strict=True) == cwd and any((cwd / item).resolve(strict=False) == source_paths["runtimePressureSource"] for item in argv[:argv.index("--")]), "Recorded invocation does not identify the held pressure CLI")
    missing = Path(child[0])
    c.require(missing.is_absolute() and missing.parent.resolve(strict=True) == missing.parent and str(missing) == review.get("missingExecutable") and review.get("missingExecutableObservedAbsent") is True and not os.path.lexists(missing), "Exact missing absolute executable required")
    c.require(type(result.get("exitCode")) is int and result["exitCode"] == 2 and review.get("wrapperRecordedExitCode") == 2 and result.get("startedAt") == command.get("startedAt") and isinstance(result.get("finishedAt"), str), "Actual recorded missing-launch wrapper return2 required")
    c.require(stderr.get("files_preserved") is True and stderr.get("error") == str(FileNotFoundError(2, os.strerror(2), str(missing))), "Retained stderr is not the exact missing-executable error")
    lines = [decoded(line) for line in values["stdout"].splitlines() if line]
    c.require(len(lines) == 2 and lines[0] == {"run": auth["run"], "temporary_directory": os.path.join(store.cfg.root, auth["run"])} and type(lines[1].get("free_bytes_after")) is int, "Retained stdout does not identify the original unlaunched run")
    return {"pid": None, "identity": None, "observation": None,
            "kernelExitStatusWitnessed": False, "kernelExitCode": None,
            "outcome": None, "nativeApplication": None, "launchEvidence": graph,
            "managedCommandLaunched": False, "wrapperRecordedExitCode": 2}


def application_evidence(auth, review, initial, observed, store):
    pid = auth.get("applicationPid")
    c.require(type(pid) is int and pid in initial and pid not in auth["supervisorPids"], "Explicit owned application PID required")
    original = initial[pid]
    observation = observed.get(pid)
    witnessed = (observation is not None and observation.get("exists") is True
                 and observation.get("state") == "Z"
                 and all(observation.get(key) == original.get(key) for key in ("startTimeTicks", "processGroup", "sessionId")))
    exit_code = None
    if witnessed:
        status = observation.get("rawExitStatus")
        c.require(type(status) is int and status >= 0, "Observed application wait status required")
        try:
            exit_code = os.waitstatus_to_exitcode(status)
        except ValueError as error:
            raise c.Unsafe("Application status is not an observed terminal wait status") from error
    reported = review.get("applicationKernelExitStatus")
    c.require((reported is None if exit_code is None else type(reported) is int and reported == exit_code), "Reviewed application exit differs from observed same-instance kernel status")
    graph = auth.get("nativeApplication")
    artifacts = review.get("applicationArtifacts", {})
    selected = {"inputs": "inputs.json", "outcome": "outcome.json", "verified": "verified-runner.json"}
    present = isinstance(artifacts, dict) and any(name in artifacts for name in selected.values())
    if graph is not None or present:
        c.require(isinstance(graph, dict) and set(graph) == set(selected), "Exact primary native application graph required")
        c.require(all(graph[key] == artifacts.get(name) for key, name in selected.items()), "Native application pins differ from root factual review")
        values = {key: decoded(read_pin(record)) for key, record in graph.items()}
        inputs, outcome, verified = values["inputs"], values["outcome"], values["verified"]
        c.require(inputs.get("lifecycle") == {"root": store.cfg.root, "run": auth["run"]}, "Native application inputs belong to another lifecycle")
        c.require(outcome.get("inputManifestSha256") == graph["inputs"]["sha256"] and outcome.get("status") == review.get("applicationOutcome"), "Own application outcome/input join differs")
        c.require(outcome.get("browserStatus") == verified.get("status"), "Own application/native verifier status join differs")
        executable = os.path.join(store.cfg.root, auth["run"], "chromium")
        launch = verified.get("launch", {})
        c.require(launch.get("requested", {}).get("executablePath") == executable and isinstance(launch.get("actualArgv"), list) and launch["actualArgv"][:1] == [executable], "Native verifier belongs to another controlled run")
        scene = verified.get("sceneStatus", {})
        c.require(scene.get("engine") == inputs.get("engine") and scene.get("trial") == inputs.get("trial"), "Native scene/input identity differs")
    return {"pid": pid, "identity": original, "observation": observation,
            "kernelExitStatusWitnessed": witnessed, "kernelExitCode": exit_code,
            "outcome": review.get("applicationOutcome"), "nativeApplication": graph}


def review_authority(store, run, raw, authorization_pin):
    auth = decoded(read_pin(authorization_pin))
    c.require(auth.get("schema") == AUTH_SCHEMA and auth.get("status") == "authorized" and auth.get("authorizedBy") == "/root", "Explicit root interruption authorization required")
    c.require(auth.get("root") == store.cfg.root and auth.get("rootMarker") == store.marker and auth.get("run") == run, "Root/run/marker authority differs")
    stat = os.fstat(store.fd)
    c.require(auth.get("rootIdentity") == {"device": stat.st_dev, "inode": stat.st_ino}, "Authorized root FD identity differs")
    c.require(auth.get("helperSource") == pin(Path(__file__).resolve()), "Reviewed interruption helper source differs")
    review = decoded(read_pin(auth["rootReview"]))
    kind = auth.get("interruptionKind")
    c.require(kind in ("supervisor-interrupted", "command-not-launched") and kind == review.get("interruptionKind", "supervisor-interrupted"), "Explicit supported interruption kind required")
    manifest = decoded(raw)
    c.validate_manifest(manifest, run)
    c.require(manifest["state"] == "active" and review.get("schema") == REVIEW_SCHEMA and review.get("run") == run and review.get("job") == manifest["job"], "Root review does not join original ACTIVE run")
    c.require(hashlib.sha256(raw).hexdigest() == review["originalManifest"]["sha256"] and raw == read_pin(review["preservedOriginalManifest"]), "Original ACTIVE manifest changed")
    c.require(review["originalManifest"]["path"] == os.path.join(store.cfg.root, run, c.MANIFEST), "Original manifest path differs")
    audit = read_pin(review["originalAudit"], immutable=False)
    c.require(audit == read_pin(review["preservedOriginalAudit"]), "Original audit changed")
    events = [decoded(line) for line in audit.splitlines() if line]
    c.require(events and events[0].get("event") == "run-start" and events[0].get("run") == run and events[0].get("job") == manifest["job"], "Exact original run-start audit required")
    c.require(events[0].get("root") == store.cfg.root and type(events[0].get("at_ns")) is int and events[0]["at_ns"] >= manifest["created_ns"], "Run-start audit root/time does not join manifest creation")
    for key in ("wrapperCompleted", "wrapperReaped", "officialDriverCompleted", "oldCapacitySlotCompleted", "roundEligibleForCombinedScoring", "sourceOrManifestRewritten", "nativeProcessesSignaledByRoot"):
        c.require(review.get(key) is False, "Root review must preserve interruption limitations: " + key)
    c.require(review.get("rawManifestStillActive") is True and review.get("exclusiveLifecycleLockObservedAvailable") is True and review.get("liveOwnedSessionProcesses") == [], "Root review closure incomplete")
    if kind == "command-not-launched":
        return auth, review, no_launch_evidence(auth, review, manifest, events, store)
    c.require(len(events) == 1, "Only exact interrupted start-only audit can resolve")
    supervisors = auth.get("supervisorPids")
    observed = {item["pid"]: item for item in review.get("actualProcessClosureObservations", [])}
    initial = {item["pid"]: item for item in decoded(read_pin(review["initialProcessOwnershipSnapshot"]))["processes"]}
    c.require(isinstance(supervisors, list) and 0 < len(supervisors) <= 8 and len(set(supervisors)) == len(supervisors), "Exact observed failed supervisor identities required")
    c.require(all(pid in observed and pid in initial and all(observed[pid].get(key) == initial[pid].get(key) for key in ("startTimeTicks", "processGroup", "sessionId")) and observed[pid].get("exists") is True and observed[pid].get("state") == "Z" and type(observed[pid].get("rawExitStatus")) is int and observed[pid]["rawExitStatus"] != 0 for pid in supervisors), "No observed failed supervisor status; never infer an exit")
    return auth, review, application_evidence(auth, review, initial, observed, store)


def validate_locked(store, run, fd, raw, receipt_pins=()):
    """Effective quiescence only. No discovery, completion, registration or retirement."""
    c.require(isinstance(receipt_pins, (list, tuple)) and len(receipt_pins) <= MAX_RECEIPTS, "Bounded caller-pinned resolutions required")
    try:
        fcntl.flock(store.lock_fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError as error:
        raise c.Busy("Exclusive lifecycle boundary unavailable") from error
    selected = []
    for record in receipt_pins:
        value = decoded(read_pin(record))
        if value.get("run") == run:
            selected.append(value)
    c.require(len(selected) == 1, "Unresolved ACTIVE lifecycle requires one explicit caller-pinned interruption resolution")
    receipt = selected[0]
    c.require(receipt.get("schema") == SCHEMA and receipt.get("effectiveState") == "resolved-interruption" and receipt.get("wrapperCompleted") is False and receipt.get("wrapperReaped") is False and receipt.get("wrapperExitCode") is None and receipt.get("scoringEligible") is False and receipt.get("resumePermitted") is False, "Not a bounded interruption resolution")
    auth, review, application = review_authority(store, run, raw, receipt["authorization"])
    c.require(receipt["rootReview"] == auth["rootReview"] and receipt["originalManifestSha256"] == hashlib.sha256(raw).hexdigest(), "Resolution evidence joins differ")
    c.require(receipt.get("interruptionKind") == auth["interruptionKind"] and receipt.get("rootIdentity") == auth["rootIdentity"], "Resolution kind/root provenance differs")
    c.require(receipt.get("applicationProcess") == application and receipt.get("applicationPid") == application["pid"] and receipt.get("applicationKernelExitStatus") == application["kernelExitCode"] and receipt.get("applicationOutcome") == application["outcome"], "Resolution application provenance differs")
    process_closure(review)  # Fresh stat metadata under the caller's exclusive lock.
    current, _, _ = c.read_file(fd, c.MANIFEST, c.MAX_JSON)
    c.require(current == raw, "Manifest changed during quiescence validation")
    return "resolved-interruption"


def resolve(authorization_pin, output):
    auth = decoded(read_pin(authorization_pin))
    c.require(auth.get("outputRoot") == str(output) and output.is_absolute() and output.resolve(strict=False) == output, "Exact new authorized output required")
    c.require(os.path.commonpath((str(output), auth["root"])) != auth["root"], "Evidence must survive outside scratch")
    cfg = c.Config(auth["root"], str(output))
    with c.Store(cfg) as store, store.locked(exclusive=True):
        fd = c.open_run(store, auth["run"])
        try:
            with c.registry_lock(fd):
                raw, _, _ = c.read_file(fd, c.MANIFEST, c.MAX_JSON)
                auth, review, application = review_authority(store, auth["run"], raw, authorization_pin)
                before = process_closure(review)
                output.mkdir(mode=0o700)  # Create-only; no alternate output or repair.
                c.require(process_closure(review) == before, "Process closure changed during resolution")
                current, _, _ = c.read_file(fd, c.MANIFEST, c.MAX_JSON)
                c.require(current == raw, "Manifest changed while resolving interruption")
                for name, value in (("original-manifest.json", raw), ("original-lifecycle-audit.jsonl", read_pin(review["originalAudit"], immutable=False))):
                    with (output / name).open("xb") as stream:
                        stream.write(value); stream.flush(); os.fsync(stream.fileno())
                    (output / name).chmod(0o444)
                receipt = {"schema": SCHEMA, "root": cfg.root, "rootIdentity": auth["rootIdentity"], "run": auth["run"], "job": review["job"], "interruptionKind": auth["interruptionKind"], "effectiveState": "resolved-interruption", "resolvedNs": time.time_ns(), "authorization": authorization_pin, "rootReview": auth["rootReview"], "originalManifestSha256": hashlib.sha256(raw).hexdigest(), "processClosure": before, "applicationPid": application["pid"], "applicationProcess": application, "applicationOutcome": application["outcome"], "applicationKernelExitStatus": application["kernelExitCode"], "wrapperCompleted": False, "wrapperReaped": False, "wrapperExitCode": None, "resumePermitted": False, "scoringEligible": False, "scope": "Explicit cooperative process execution closure only; no wrapper wait/reaping/completion or cache authority"}
                target = output / "receipt.json"
                with target.open("xb") as stream:
                    stream.write(c.json_bytes(receipt)); stream.flush(); os.fsync(stream.fileno())
                target.chmod(0o444)
                return pin(target)
        finally:
            os.close(fd)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--authorization", type=Path, required=True)
    parser.add_argument("--authorization-sha256", required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    record = pin(args.authorization)
    c.require(record["sha256"] == args.authorization_sha256, "Root authorization SHA differs")
    print(json.dumps(resolve(record, args.output)))


if __name__ == "__main__":
    main()
