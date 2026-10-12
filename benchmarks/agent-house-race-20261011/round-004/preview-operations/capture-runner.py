#!/usr/bin/env python3
"""Capture one explicitly authorized plain preview coordinator; never enclose its native lifecycles."""
import argparse
import datetime
import hashlib
import json
import os
from pathlib import Path
import selectors
import subprocess
import sys
import time

def now(): return datetime.datetime.now(datetime.timezone.utc).isoformat()
def digest(raw): return hashlib.sha256(raw).hexdigest()
def require(value, message):
    if not value: raise RuntimeError(message)
def read(path):
    path = Path(path)
    require(path.is_absolute() and path.resolve(strict=True) == path and path.is_file() and not path.is_symlink(), "Canonical regular input required")
    return path.read_bytes()
def pin(path):
    raw = read(path)
    return {"path": str(path), "bytes": len(raw), "sha256": digest(raw)}
def new(path, raw):
    with path.open("xb") as stream:
        stream.write(raw); stream.flush(); os.fsync(stream.fileno())
    path.chmod(0o444)
def new_json(path, value): new(path, (json.dumps(value, indent=2) + "\n").encode())

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--spec", required=True, type=Path)
    parser.add_argument("--spec-sha256", required=True)
    parser.add_argument("--config-sha256", required=True)
    parser.add_argument("--authorization", required=True, type=Path)
    parser.add_argument("--authorization-sha256", required=True)
    args = parser.parse_args()
    authorization_raw = read(args.authorization)
    require(digest(authorization_raw) == args.authorization_sha256, "Separate root preview authorization pin differs")
    authorization = json.loads(authorization_raw)
    require(authorization["schema"] == "aperture.round004-preview-activation.v1" and authorization["round"] == "round-004" and authorization["status"] == "authorized" and authorization["authorizedBy"] == "/root", "Separate actual root preview activation required")
    for key in ("rootSdkAndIsolationReviewComplete", "inputFreezeReviewed", "configurationActivated", "priorWorkAndLifecyclesClosed", "previewWindowReleased", "freshForkNoneSameRootModelOnly", "registryRegistrationDeferred"):
        require(authorization.get(key) is True, "Preview root prerequisite missing: " + key)
    require(authorization["pins"]["runner"] == pin(Path(__file__).resolve()) and authorization["pins"]["spec"] == pin(args.spec), "Root preview runner/spec differs")
    spec_raw = read(args.spec)
    require(digest(spec_raw) == args.spec_sha256, "Reviewed capture spec changed")
    spec = json.loads(spec_raw)
    require(spec["schema"] == "aperture.preview-coordinator-capture-spec.v1" and spec["state"] == "root-reviewed-ready-for-launch", "Unexpected or unreviewed capture spec")
    root = Path('/workspace/aperture')
    round_root = root / 'benchmarks/agent-house-race-20261011/round-004'
    expected_argv = ['python3', '-B', str(root / 'tools/agent-benchmark/preview-service-v3.py'), '--config', str(root / '.aperture-env/agent-house-race/control/lanes.json')]
    require(spec['argv'] == expected_argv and spec['cwd'] == str(root) and spec['outputRoot'] == str(round_root / 'preview-operations') and spec['transcriptRoot'] == str(round_root / 'authors') and spec['configPath'] == expected_argv[-1], 'Exact preview paths/argv differ')
    require(spec['captureRunner'] == authorization['pins']['runner'] and spec['inputFreeze'] == authorization['pins']['inputFreeze'], 'Root preview freeze/runner bindings differ')
    require(authorization['pins']['sdkInputReview'] == pin(authorization['pins']['sdkInputReview']['path']), 'Actual SDK input review pin differs')
    require(spec['sourceTemplatePins'] == authorization['pins']['sourceTemplatePins'] and pin(spec['sourceTemplatePins']['path']) == spec['sourceTemplatePins'], 'Reviewed source template baseline differs')
    baseline = json.loads(read(spec['sourceTemplatePins']['path']))
    require(spec['sourcePins'] == baseline['currentControlSourcePins'], 'Complete shared control baseline missing')
    require(spec['inputFreeze']['path'] == str(root / 'benchmarks/agent-house-race-20261011/freezes/round-004-inputs.json'), 'Other round input freeze supplied')
    require(pin(spec['inputFreeze']['path']) == spec['inputFreeze'], 'Actual input freeze hash differs')
    frozen = json.loads(read(spec['inputFreeze']['path']))
    for item in spec['sourcePins']:
        label = Path(item['path']).relative_to(root).as_posix()
        copied = frozen['provenance']['inputs'][label]
        require(all(copied[key] == item[key] for key in ('bytes','sha256')), 'Input freeze control dependency differs')
        require(pin(root / copied['snapshotPath']) == {'path': str(root / copied['snapshotPath']), 'bytes': copied['bytes'], 'sha256': copied['sha256']}, 'Frozen shared control copy differs')
    require(args.config_sha256 == spec["expectedConfigSha256"] == authorization["configurationSha256"], "Root activated config pin differs")
    require(len(args.config_sha256) == 64 and all(c in "0123456789abcdef" for c in args.config_sha256), "Exact activated configuration SHA required")
    config_raw = read(spec["configPath"])
    require(len(config_raw) <= 1024 * 1024 and digest(config_raw) == args.config_sha256, "Root-activated configuration differs")
    config = json.loads(config_raw)
    expected_pending = frozen['files']['benchmarks/agent-house-race-20261011/round-004/setup/lanes.pending.json']
    require(expected_pending['sha256'] == args.config_sha256 and expected_pending['bytes'] == len(config_raw), 'Activated lanes differ from frozen new-round pending configuration')

    require(config["schema"] == "aperture.author-lanes.v1" and config["transcriptRoot"] == spec["transcriptRoot"] and set(config["lanes"]) == {"three-r004", "aperture-r004"}, "Configuration is not the reviewed round004")
    for engine in ("three", "aperture"):
        lane = config["lanes"][engine + "-r004"]
        require(lane["engine"] == engine and lane["previewProtocol"] == "frozen-build-v2" and lane["previewDiagnosticSchema"] == "aperture.agent-house-diagnostic-preview.v3" and lane["budgetSeconds"] == 1800, "Own lane/schema/budget differs")
    for item in [spec["inputFreeze"], spec["captureRunner"], *spec["sourcePins"]]:
        actual = pin(item["path"])
        require(actual["bytes"] == item["bytes"] and actual["sha256"] == item["sha256"], "Pinned capture/coordinator/lane/wrapper/freeze source changed")
    output = Path(spec["outputRoot"])
    require(output.parent.is_dir() and not os.path.lexists(output), "Create-only public output must not already exist")
    output.mkdir(mode=0o700)
    new(output / "active-config.json", config_raw)
    new(output / "capture-spec.json", spec_raw)
    new(output / "root-authorization.json", authorization_raw)
    new(output / "capture-runner.py", read(spec["captureRunner"]["path"]))
    command = {"schema": "aperture.preview-coordinator-command.v1", "argv": spec["argv"], "cwd": spec["cwd"], "recordedAt": now(), "configuration": {"path": spec["configPath"], "bytes": len(config_raw), "sha256": args.config_sha256}, "retainedConfiguration": pin(output / "active-config.json"), "captureSpecSha256": args.spec_sha256, "captureRunner": spec["captureRunner"], "sourcePins": spec["sourcePins"], "inputFreeze": spec["inputFreeze"], "executionMode": "plain Python serial coordinator; every native request adopts its own runtime_pressure lifecycle", "environment": "Inherited; no environment values dumped or changed", "timeoutPolicy": "No enclosing lifecycle or subprocess deadline; await actual natural coordinator exit."}
    new_json(output / "command.json", command)
    started = now(); clock = time.monotonic()
    with (output / "stdout.bin").open("xb") as stdout, (output / "stderr.bin").open("xb") as stderr:
        child = subprocess.Popen(spec["argv"], cwd=spec["cwd"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, bufsize=0)
        new_json(output / "start.json", {"schema": "aperture.preview-coordinator-start.v1", "startedAt": started, "coordinatorPid": child.pid, "configurationSha256": args.config_sha256, "inputFreeze": spec["inputFreeze"], "coordinatorWrappedInLifecycle": False})
        with selectors.DefaultSelector() as selector:
            selector.register(child.stdout, selectors.EVENT_READ, (stdout, sys.stdout.buffer))
            selector.register(child.stderr, selectors.EVENT_READ, (stderr, sys.stderr.buffer))
            while selector.get_map():
                for key, _events in selector.select():
                    raw = os.read(key.fd, 65536)
                    if not raw:
                        selector.unregister(key.fileobj); key.fileobj.close(); continue
                    retained, display = key.data
                    retained.write(raw); retained.flush()
                    display.write(raw); display.flush()
        exit_code = child.wait()
    config_after = pin(spec["configPath"])
    finishes = {lane: pin(Path(spec["transcriptRoot"]) / lane / "finish.json") if (Path(spec["transcriptRoot"]) / lane / "finish.json").is_file() else None for lane in config["lanes"]}
    source_parity = all(pin(item["path"]) == item for item in spec["sourcePins"])
    closed = exit_code == 0 and all(finishes.values()) and config_after["sha256"] == args.config_sha256 and source_parity
    result = {"schema": "aperture.preview-coordinator-result.v1", "status": "closed-coordinator-after-both-finishes" if closed else "coordinator-exited-preserve-and-review", "startedAt": started, "finishedAt": now(), "coordinatorPid": child.pid, "coordinatorExitCode": exit_code, "processWallSeconds": time.monotonic() - clock, "stdout": pin(output / "stdout.bin"), "stderr": pin(output / "stderr.bin"), "configurationAfterExit": config_after, "configurationBytesUnchanged": config_after["sha256"] == args.config_sha256, "sourcePinsUnchanged": source_parity, "finishedAuthors": finishes, "nativeLifecycleScope": "Each preview has its own adopted audit/manifest; this plain coordinator exit does not replace root review of those lifecycle closures or sharedlock quiescence."}
    new_json(output / "result.json", result)
    (output / "stdout.bin").chmod(0o444); (output / "stderr.bin").chmod(0o444)
    print(json.dumps({"coordinatorCaptureResult": str(output / "result.json"), "coordinatorExitCode": exit_code, "status": result["status"]}), flush=True)
    return exit_code if exit_code >= 0 else 128 - exit_code

if __name__ == "__main__": raise SystemExit(main())
