"""Create-only, session-isolated official driver recorder. No native launch policy.

The launcher returns only after a real recorder/driver identity handshake. The
detached recorder waits for the real driver and retains its actual exit. Neither
transport loss nor a missing handshake authorizes another invocation.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import time

SCHEMA = "aperture.durable-official-driver-launch.v1"


def require(value, message):
    if not value:
        raise RuntimeError(message)


def pinned(record):
    path = Path(record["path"])
    require(path.is_absolute() and path.resolve(strict=True) == path and path.is_file() and not path.stat().st_mode & 0o222 and path.stat().st_nlink == 1, "Readonly canonical unlinked input required")
    raw = path.read_bytes()
    require(len(raw) == record["bytes"] and hashlib.sha256(raw).hexdigest() == record["sha256"], "Durable input pin differs")
    return raw


def pin(path):
    raw = path.read_bytes()
    return {"path": str(path), "bytes": len(raw), "sha256": hashlib.sha256(raw).hexdigest()}


def immutable(path, raw):
    with path.open("xb") as stream:
        stream.write(raw); stream.flush(); os.fsync(stream.fileno())
    path.chmod(0o444)


def save(path, value):
    immutable(path, (json.dumps(value, indent=2) + "\n").encode())


def identity(pid):
    raw = Path(f"/proc/{pid}/stat").read_text()
    fields = raw[raw.rfind(")") + 2:].split()
    require(len(fields) >= 50, "Incomplete actual process identity")
    return {"pid": pid, "startTimeTicks": int(fields[19]), "processGroup": int(fields[2]), "sessionId": int(fields[3])}


def read_spec(path, expected):
    record = pin(path)
    require(record["sha256"] == expected, "Exact launch spec SHA required")
    raw = pinned(record)
    spec = json.loads(raw)
    require(spec.get("schema") == SCHEMA, "Wrong durable launch spec")
    require(spec.get("recorderSha256") == pin(Path(__file__).resolve())["sha256"], "Reviewed durable recorder source differs")
    plan = json.loads(pinned(spec["plan"]))
    authorization = json.loads(pinned(spec["authorization"]))
    require(plan["schema"] == "aperture.official-trial-plan.v1" and authorization["schema"] == "aperture.official-trial-authorization.v1" and authorization["status"] == "authorized" and authorization["authorizedBy"] == "/root" and authorization["planSha256"] == spec["plan"]["sha256"] and authorization["round"] == plan["round"], "Actual selected root plan/authorization required")
    cwd = Path(plan["cwd"])
    output = Path(spec["outputRoot"])
    require(cwd.is_absolute() and cwd.resolve(strict=True) == cwd and output.is_absolute() and output.parent.resolve(strict=True) == output.parent and output.parent.stat().st_dev == cwd.stat().st_dev, "Canonical same-filesystem capture required")
    require(plan["driver"]["path"] == str(cwd / "tools/agent-benchmark/official-trials-v2.py"), "Use the held active public driver/helper import graph")
    pinned(plan["driver"])
    python = Path(spec["pythonExecutable"])
    require(python.is_absolute() and python.resolve(strict=True) == python and python == Path(sys.executable).resolve(), "Exact current physical Python interpreter required")
    argv = [str(python), "-B", plan["driver"]["path"], "--plan", spec["plan"]["path"], "--plan-sha256", spec["plan"]["sha256"], "--authorization", spec["authorization"]["path"], "--authorization-sha256", spec["authorization"]["sha256"]]
    return spec, plan, raw, argv


def record(path, expected):
    spec, plan, _, argv = read_spec(path, expected)
    output = Path(spec["outputRoot"])
    started = time.time_ns(); monotonic = time.monotonic_ns()
    own = identity(os.getpid())
    require(own["pid"] == own["sessionId"] == own["processGroup"], "Recorder must own an isolated session")
    save(output / "recorder-start.json", {"schema": SCHEMA, "startedNs": started, "recorder": own, "launchSpec": pin(path), "argv": argv, "cwd": plan["cwd"], "environmentOverlay": {"APERTURE_WEBGPU_RUNTIME": plan["runtimeRoot"]}, "parentTransportDependency": False})
    with (output / "stdout.bin").open("xb") as stdout, (output / "stderr.bin").open("xb") as stderr:
        child = subprocess.Popen(argv, cwd=plan["cwd"], env={**os.environ, "APERTURE_WEBGPU_RUNTIME": plan["runtimeRoot"]}, stdin=subprocess.DEVNULL, stdout=stdout, stderr=stderr, close_fds=True)
        driver = identity(child.pid)
        require(driver["sessionId"] == own["sessionId"], "Driver escaped recorder supervision session")
        save(output / "started.json", {"schema": SCHEMA, "startedNs": started, "recorder": own, "driver": driver, "launchSpec": pin(path), "plan": spec["plan"], "authorization": spec["authorization"], "driverSource": plan['driver'], "capacityPolicy": plan.get('capacityPolicy'), "argv": argv, "actualChildWaitPending": True})
        code = child.wait()
        for stream in (stdout, stderr):
            stream.flush(); os.fsync(stream.fileno())
    for name in ("stdout.bin", "stderr.bin"):
        (output / name).chmod(0o444)
    save(output / "result.json", {"schema": SCHEMA, "startedNs": started, "finishedNs": time.time_ns(), "processWallSeconds": (time.monotonic_ns() - monotonic) / 1e9, "driverExitCode": code, "actualChildWaitReturned": True, "recorder": own, "driver": driver, "stdout": pin(output / "stdout.bin"), "stderr": pin(output / "stderr.bin"), "scope": "Actual driver process wait only; native wrapper completions remain independent mandatory evidence"})


def launch(path, expected, handshake_seconds=10):
    spec, plan, raw, _ = read_spec(path, expected)
    output = Path(spec["outputRoot"])
    output.mkdir()  # Refuse every duplicate, even after failed transport/handshake.
    immutable(output / "launch-spec.json", raw)
    immutable(output / "recorder.py", Path(__file__).read_bytes())
    save(output / "launcher.json", {"schema": SCHEMA, "launcher": identity(os.getpid()), "launchedNs": time.time_ns(), "originalSpec": pin(path), "recorderSourceSha256": spec["recorderSha256"], "launchPolicy": "One isolated recorder plus driver; no outer lifecycle wrapper/no retries"})
    with (output / "recorder-stdout.bin").open("xb") as stdout, (output / "recorder-stderr.bin").open("xb") as stderr:
        child = subprocess.Popen([spec["pythonExecutable"], "-B", str(output / "recorder.py"), "record", "--spec", str(output / "launch-spec.json"), "--spec-sha256", expected], cwd=plan["cwd"], stdin=subprocess.DEVNULL, stdout=stdout, stderr=stderr, start_new_session=True, close_fds=True)
    save(output / "spawned.json", {"schema": SCHEMA, "recorder": identity(child.pid), "specSha256": expected})
    deadline = time.monotonic() + handshake_seconds
    while time.monotonic() < deadline:
        if (output / "started.json").exists():
            value = json.loads((output / "started.json").read_bytes())
            require(value["recorder"]["pid"] == child.pid and value["launchSpec"]["sha256"] == expected, "Actual handshake identity differs")
            return pin(output / "started.json")
        if child.poll() is not None:
            break
        time.sleep(0.02)
    # Never signal/relaunch a child whose ownership/handshake is uncertain.
    raise RuntimeError("Detached launch handshake incomplete; preserve all files and inspect actual ownership, never retry")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=("launch", "record"))
    parser.add_argument("--spec", type=Path, required=True)
    parser.add_argument("--spec-sha256", required=True)
    args = parser.parse_args()
    if args.action == "launch":
        print(json.dumps(launch(args.spec, args.spec_sha256)))
    else:
        record(args.spec, args.spec_sha256)


if __name__ == "__main__":
    main()
