#!/usr/bin/env python3
"""Next-round v3 diagnostics with symmetric numeric export preflight.

The original coordinators and their retained evidence remain unchanged. Both
lanes must freeze frozen-build-v2 plus diagnostic-v3 before dispatch. Requests
use the established adopted lifecycle and unchanged runVerifiedScene route.
"""

import argparse
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import time


SPEC = importlib.util.spec_from_file_location("preview_v3_author_lane", Path(__file__).with_name("author-lane.py"))
LANE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(LANE)
ROOT = Path(__file__).resolve().parents[2]


def validate_request(config, request_path):
    root = Path(config["transcriptRoot"])
    require = LANE.require
    require(request_path.resolve() == request_path and not request_path.is_symlink() and request_path.is_file() and request_path.stat().st_mode & 0o222 == 0 and request_path.stat().st_size <= LANE.MAX_SCRIPT_BYTES, "Preview request must be an immutable canonical file")
    raw = request_path.read_bytes()
    request = json.loads(raw)
    lane_id = request.get("lane")
    require(lane_id in config["lanes"], "Preview request lane is unknown")
    lane = config["lanes"][lane_id]
    number = request.get("number")
    require(request_path == root / lane_id / "previews" / f"{number:02d}-request.json", "Preview request belongs outside its own lane")
    LANE.validate_frozen_preview(request, request_path, lane)
    expected_artifact = request_path.with_name(f"{number:02d}-artifacts")
    expected_reply = request_path.with_name(f"{number:02d}-result.json")
    require(request.get("artifactRoot") == str(expected_artifact) and request.get("replyPath") == str(expected_reply), "Preview result/artifact path differs from own request")
    return request, raw


def preview_command(request, artifact, capacity_arguments=()):
    return [sys.executable, "-B", "tools/recovery/runtime_pressure.py", "--root", "/workspace/scratch/0190a8c72f8a/aperture-tmp", "--audit-dir", str(artifact / "audits"), *capacity_arguments, "run", "--job", f"house-{request['lane']}-diagnostic-v3-{request['number']}", "--recreation", "Immutable request-time own build; native SwiftShader diagnostic preview v3", "--", "node", "tools/agent-benchmark/preview-run-v3.mjs", "--app", request["appRoot"], "--engine", request["engine"], "--output", str(artifact / "attempt"), "--trial", str(request["number"])]


def process_request(config, request_path):
    request, raw = validate_request(config, request_path)
    artifact = Path(request["artifactRoot"])
    artifact.mkdir()  # No retry or overwrite of an unresolved lifecycle.
    output = artifact / "attempt"
    env = os.environ.copy()
    env["APERTURE_WEBGPU_RUNTIME"] = str(ROOT / ".aperture-env/render-runtime")
    capacity_arguments = ()
    capacity_error = None
    slot = None
    try:
        if config.get("capacityPolicy") is not None:
            from capacity import Policy, cli_arguments
            record = config["capacityPolicy"]
            policy = Policy.load(record["path"], record["sha256"])
            slot = policy.next_slot()
            manifest = json.loads(Path(request["frozenBuildManifest"]["path"]).read_bytes())
            fresh_bytes = manifest["totalBytes"]
            minimum = slot["retainedReserveBytes"] + max(0, fresh_bytes - slot.get("expectedInputBytes", 0))
            capacity_arguments = cli_arguments(record, slot["id"], minimum)
    except (OSError, RuntimeError, ValueError, KeyError, TypeError) as error:
        capacity_error = str(error)
        LANE.write_json(artifact / "capacity-error.json", {"schema":"aperture.preview-capacity-error.v1","stage":"before-native-launch","processLaunched":False,"error":capacity_error})
    # No subprocess timer establishes teardown. The renderer/lifecycle are
    # awaited even after a diagnostic deadline; the next request cannot overlap.
    with (artifact / "render.log").open("xb") as log:
        result = subprocess.run(preview_command(request, artifact, capacity_arguments), cwd=ROOT, env=env, stdout=log, stderr=subprocess.STDOUT, check=False) if capacity_error is None else None
    if slot is not None and result is not None:
        try:
            from capacity import checkpoint_manifest
            original, join = checkpoint_manifest(config["capacityPolicy"], slot["id"], expected_job=f"house-{request['lane']}-diagnostic-v3-{request['number']}")
            LANE.write_immutable(artifact / "completed-lifecycle-manifest.json", original)
            LANE.write_json(artifact / "capacity-lifecycle.json", join)
        except (OSError, RuntimeError, ValueError, KeyError, TypeError) as error:
            capacity_error = str(error)
            LANE.write_json(artifact / "capacity-error.json", {"schema":"aperture.preview-capacity-error.v1","stage":"after-observed-wrapper-exit","processLaunched":True,"wrapperExitCode":result.returncode,"error":capacity_error})
    preflight_path = output / "geometry-preflight.json"
    preflight_bytes = preflight_path.read_bytes() if preflight_path.is_file() and preflight_path.stat().st_size <= 64 * 1024 else None
    preflight = json.loads(preflight_bytes) if preflight_bytes is not None else None
    captures = [str(output / f"{view}.png") for view in ("canonical", "left-orbit", "rear-orbit") if (output / f"{view}.png").is_file()]
    response = {"schema": "aperture.author-preview-result.v1", "previewProtocol": LANE.FROZEN_PREVIEW_PROTOCOL, "lane": request["lane"], "engine": request["engine"], "number": request["number"], "requestSha256": LANE.digest(raw), "frozenBuildManifestSha256": request["frozenBuildManifest"]["sha256"], "completedAt": LANE.utc_now(), "status": "ok" if result is not None and capacity_error is None and result.returncode == 0 and len(captures) == 3 and preflight is not None and preflight.get("schema") == "aperture.agent-house-preview-geometry-preflight.v3" and preflight.get("status") == "passed" else "error", "capturePaths": captures}
    response["diagnosticSchema"] = "aperture.agent-house-diagnostic-preview.v3"
    if preflight is not None:
        response["geometryPreflightArtifact"] = {"path":str(preflight_path),"bytes":len(preflight_bytes),"sha256":LANE.digest(preflight_bytes)}
    if response["status"] == "error":
        source = next((path for path in (artifact / "capacity-error.json", output / "geometry-preflight-error.json", output / "failure.json", output / "verified-runner.json", artifact / "render.log") if path.is_file()), None)
        details = source.read_bytes()[-LANE.MAX_INLINE_ERROR_BYTES:] if source else b"Diagnostic preview failed without a surviving renderer diagnostic"
        error_path = artifact / "public-error.txt"
        LANE.write_immutable(error_path, details)
        response["errorPath"] = str(error_path)
    for path in artifact.rglob("*"):
        if path.is_file():
            path.chmod(0o444)
    LANE.write_json(Path(request["replyPath"]), response)
    return response


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", type=Path, default=LANE.CONFIG)
    args = parser.parse_args(argv)
    config = LANE.load_config(args.config)
    LANE.require(all(lane.get("previewProtocol") == LANE.FROZEN_PREVIEW_PROTOCOL for lane in config["lanes"].values()), "Both next-round lanes must freeze frozen-build-v2 before dispatch")
    LANE.require(all(lane.get("previewDiagnosticSchema") == "aperture.agent-house-diagnostic-preview.v3" for lane in config["lanes"].values()), "Both lanes must disclose and freeze diagnostic preview v3 before dispatch")
    transcripts = Path(config["transcriptRoot"])
    print("Frozen-build-v2 diagnostic-v3 coordinator ready", flush=True)
    while True:
        requests = sorted(transcripts.glob("*/previews/*-request.json"), key=lambda path: json.loads(path.read_bytes())["requestedMonotonicNs"])
        for request_path in requests:
            request, _ = validate_request(config, request_path)
            if Path(request["replyPath"]).exists():
                continue
            print(f"Serving frozen {request['lane']} diagnostic preview {request['number']}", flush=True)
            response = process_request(config, request_path)
            print(f"{request['lane']} diagnostic preview {request['number']}: {response['status']}", flush=True)
        if all((transcripts / lane / "finish.json").exists() for lane in config["lanes"]):
            return 0
        time.sleep(0.5)


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (LANE.LaneError, OSError, ValueError, KeyError, TypeError) as error:
        print("Frozen preview coordinator refused: " + str(error), file=sys.stderr)
        sys.exit(2)
