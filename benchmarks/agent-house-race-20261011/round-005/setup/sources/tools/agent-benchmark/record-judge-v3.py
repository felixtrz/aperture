#!/usr/bin/env python3
"""Public v3 judge journal: allowlisted reads, exact live PNG transport witnesses, original JSON."""
import argparse
import datetime
import fcntl
import hashlib
import json
import os
from pathlib import Path
import struct
import sys
import time

from judge_image_v3 import validate as validate_live_image

def require(value, message):
    if not value: raise RuntimeError(message)
def canonical(value): return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()
def sha(raw): return hashlib.sha256(raw).hexdigest()
def now(): return datetime.datetime.now(datetime.timezone.utc).isoformat()
def regular(path, limit):
    path = Path(path)
    require(path.is_absolute() and path.resolve(strict=True) == path and path.is_file() and not path.is_symlink() and path.stat().st_mode & 0o222 == 0 and path.stat().st_size <= limit, "Bounded readonly canonical input required")
    return path.read_bytes()
def new(path, raw):
    with path.open("xb") as stream: stream.write(raw)
    path.chmod(0o444)
def new_json(path, value): new(path, json.dumps(value, ensure_ascii=False, indent=2).encode() + b"\n")
def file_pin(path, raw): return {"path": str(path), "bytes": len(raw), "sha256": sha(raw)}

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--spec", required=True, type=Path)
    parser.add_argument("--spec-sha256", required=True)
    sub = parser.add_subparsers(dest="action", required=True)
    sub.add_parser("start")
    sub.add_parser("helper")
    sub.add_parser("facts").add_argument("asset")
    sub.add_parser("image-request").add_argument("asset")
    response = sub.add_parser("image-response")
    response.add_argument("request")
    response.add_argument("--metadata-json", required=True)
    finish = sub.add_parser("finish")
    finish.add_argument("--json-text", required=True)
    args = parser.parse_args()
    spec_raw = regular(args.spec, 64 * 1024)
    require(sha(spec_raw) == args.spec_sha256, "Exact reviewed judge spec SHA differs")
    spec = json.loads(spec_raw)
    require(spec["schema"] == "aperture.blind-judge-operation-spec.v2" and isinstance(spec["judgeId"], str) and spec["judgeId"], "Final judge identity/spec missing")
    bundle = Path(spec["bundleRoot"])
    require(bundle.is_absolute() and bundle.resolve(strict=True) == bundle, "Canonical opaque bundle required")
    cases = spec["caseIds"]
    require(len(cases) == 2 and len(set(cases)) == 2 and all(case.startswith("case-") and "aperture" not in case.lower() and "three" not in case.lower() for case in cases), "Two opaque case IDs required")
    assets = {item["id"]: item for item in spec["inputs"]}
    require(len(assets) == len(spec["inputs"]) == 9 and sum(item["kind"] == "image" for item in assets.values()) == 7 and sum(item["kind"] == "facts" for item in assets.values()) == 2, "Exactly shared reference/six views/two fact files required")
    expected_images = {"reference"} | {case + "-" + view for case in cases for view in ("canonical", "left-orbit", "rear-orbit")}
    expected_facts = {case + "-facts" for case in cases}
    require(set(assets) == expected_images | expected_facts and all(assets[key]["kind"] == "image" for key in expected_images) and all(assets[key]["kind"] == "facts" for key in expected_facts), "Reference and all three views/facts must join each opaque case exactly")
    source_raw = regular(Path(__file__).resolve(), 64 * 1024)
    require(sha(source_raw) == spec["recorderSha256"], "Reviewed public recorder source changed")
    helper_path = Path(__file__).resolve().with_name("live-image-response-v3.mjs")
    helper_raw = regular(helper_path, 32 * 1024)
    require(sha(helper_raw) == spec["liveHelperSha256"], "Reviewed live response helper changed")
    validator_path = Path(__file__).resolve().with_name("judge_image_v3.py")
    validator_raw = regular(validator_path, 32 * 1024)
    require(sha(validator_raw) == spec["validatorSha256"], "Reviewed PNG response validator changed")
    require(spec.get("responseMetadataSchema") == "aperture.live-image-transport.v3", "Explicit v3 decoded transport protocol required")
    output = Path(spec["outputRoot"])
    require(output.is_absolute() and not output.is_relative_to(bundle) and not bundle.is_relative_to(output), "Own output belongs outside readonly input bundle")
    if args.action == "start":
        require(not output.exists(), "Create-only own judge journal already exists")
        output.mkdir(parents=True)
        new(output / "input-spec.json", spec_raw)
        new(output / "recorder.py", source_raw)
        new(output / "live-image-response-v3.mjs", helper_raw)
        new(output / "judge_image_v3.py", validator_raw)
        (output / "operations").mkdir()
        state = {"schema": "aperture.blind-judge-state.v1", "judgeId": spec["judgeId"], "specSha256": args.spec_sha256, "sequence": 0, "headSha256": "0" * 64, "helperRead": False, "factsRead": [], "requests": {}, "responses": {}, "finished": False}
        (output / "state.json").write_bytes(canonical(state) + b"\n")
    require(output.is_dir() and not output.is_symlink(), "Start your own actual journal before any read/view")
    with (output / ".lock").open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        state = json.loads((output / "state.json").read_bytes())
        require(state["specSha256"] == args.spec_sha256 and state["judgeId"] == spec["judgeId"] and not state["finished"] and state["sequence"] < 256, "Wrong/closed/over-budget journal")
        ordinal = state["sequence"] + 1
        operation = output / "operations" / f"{ordinal:04d}"
        operation.mkdir()
        command = {"schema": "aperture.blind-judge-command.v1", "argv": sys.argv, "cwd": str(Path.cwd()), "recordedAt": now(), "pid": os.getpid(), "action": args.action, "inputSpecSha256": args.spec_sha256, "sourceSha256": sha(source_raw)}
        new_json(operation / "command.json", command)
        started = time.monotonic(); stdout = b""; stderr = b""; code = 0; detail = {}
        def input_bytes(asset_id, kind):
            require(asset_id in assets and assets[asset_id]["kind"] == kind, "Read only the requested allowlisted input")
            item = assets[asset_id]; path = Path(item["path"])
            require(path.is_relative_to(bundle), "Input escaped opaque bundle")
            raw = regular(path, 32 * 1024 * 1024 if kind == "image" else 8 * 1024)
            require(len(raw) == item["bytes"] and sha(raw) == item["sha256"], "Frozen opaque input bytes changed")
            return item, raw
        try:
            if args.action == "start":
                verified = []
                for asset_id, item in assets.items():
                    _item, raw = input_bytes(asset_id, item["kind"])
                    verified.append(file_pin(item["path"], raw))
                detail = {"verifiedInputPins": verified, "actualStart": True}
                stdout = canonical({"ok": True, "judgeId": spec["judgeId"], "inputsVerified": len(verified)}) + b"\n"
            elif args.action == "helper":
                require(not state["helperRead"], "Exact live helper already read")
                state["helperRead"] = True
                detail = {"liveHelper": file_pin(helper_path, helper_raw), "meaning": "Exact public pure-JavaScript helper bytes emitted to stdout; decode/hash only the actual returned result.image_url, never substitute source bytes."}
                stdout = helper_raw
            elif args.action == "facts":
                item, raw = input_bytes(args.asset, "facts")
                raw.decode("utf-8", errors="strict")
                detail = {"asset": args.asset, "inputPin": file_pin(item["path"], raw), "meaning": "Exact allowed neutral facts bytes emitted to tool stdout, without summaries or substitutions."}
                if args.asset not in state["factsRead"]: state["factsRead"].append(args.asset)
                stdout = raw
            elif args.action == "image-request":
                require(state["helperRead"], "Read the exact recorded live helper first")
                item, raw = input_bytes(args.asset, "image")
                require(raw[:8] == b"\x89PNG\r\n\x1a\n" and raw[12:16] == b"IHDR", "Unchanged PNG input required")
                width, height = struct.unpack(">II", raw[16:24])
                request_id = f"view-{ordinal:04d}"
                detail = {"requestId": request_id, "asset": args.asset, "inputPin": file_pin(item["path"], raw), "pngDimensions": {"width": width, "height": height}, "tool": "tools.view_image", "toolArguments": {"path": item["path"], "detail": "original"}}
                state["requests"][request_id] = detail
                new_json(operation / "image-request.json", detail)
                stdout = canonical(detail) + b"\n"
            elif args.action == "image-response":
                require(args.request in state["requests"] and args.request not in state["responses"] and len(args.metadata_json.encode()) <= 16 * 1024, "Actual unique bounded image response required")
                request = state["requests"][args.request]; item, raw = input_bytes(request["asset"], "image")
                metadata = json.loads(args.metadata_json)
                require(set(metadata) == {"tool", "toolArguments", "response"} and metadata["tool"] == request["tool"] and metadata["toolArguments"] == request["toolArguments"], "Live image tool arguments differ from recorded request")
                response = metadata["response"]
                transport = validate_live_image(request, metadata, raw)
                detail = {"requestId": args.request, "asset": request["asset"], "unchangedInputPin": file_pin(item["path"], raw), "reportedLiveToolResponse": metadata, "validatedTransport": transport, "attribution": "Judge supplied metadata from the actual live functions.exec view tool orchestration; source PNG hashes are independently checked. No provider/private reasoning transcript is inferred."}
                state["responses"][args.request] = detail
                new_json(operation / "image-response.json", detail)
                stdout = canonical({"ok": True, "requestId": args.request, "sourceSha256": item["sha256"]}) + b"\n"
            elif args.action == "finish":
                require(state["helperRead"], "Recorded live helper read required")
                require(set(state["factsRead"]) == {key for key,item in assets.items() if item["kind"] == "facts"} and {value["asset"] for value in state["responses"].values()} == {key for key,item in assets.items() if item["kind"] == "image"}, "Actually route both fact reads and all seven image responses before finishing")
                require(set(state["requests"]) == set(state["responses"]), "Unresolved live image requests remain in the actual public journal")
                raw = args.json_text.encode("utf-8")
                require(len(raw) <= 64 * 1024, "Bounded original final JSON required")
                value = json.loads(raw)
                require(value["judgeId"] == spec["judgeId"] and isinstance(value["cases"], list) and len(value["cases"]) == 2 and {case["case"] for case in value["cases"]} == set(cases), "Original final identity/case inventory differs")
                new(output / "original-final.json", raw)
                detail = {"originalFinal": file_pin(output / "original-final.json", raw), "meaning": "Exact submitted original UTF8 JSON bytes, parsed for identity/case inventory only and never reserialized."}
                state["finished"] = True
                stdout = canonical({"ok": True, **detail}) + b"\n"
        except Exception as error:
            code = 2; stderr = (str(error) + "\n").encode(); detail = {"error": str(error), "failedActionPreserved": True}
        new(operation / "stdout.bin", stdout); new(operation / "stderr.bin", stderr)
        result = {"schema": "aperture.blind-judge-operation.v1", "exitCode": code, "finishedAt": now(), "processOperationSeconds": time.monotonic() - started, "stdout": file_pin(operation / "stdout.bin", stdout), "stderr": file_pin(operation / "stderr.bin", stderr), "detail": detail}
        new_json(operation / "result.json", result)
        event = {"schema": "aperture.blind-judge-public-event.v1", "sequence": ordinal, "previousSha256": state["headSha256"], "recordedAt": now(), "monotonicNs": time.monotonic_ns(), "judgeId": spec["judgeId"], "action": args.action, "command": file_pin(operation / "command.json", (operation / "command.json").read_bytes()), "result": file_pin(operation / "result.json", (operation / "result.json").read_bytes())}
        event["sha256"] = sha(canonical(event))
        with (output / "events.jsonl").open("ab") as stream: stream.write(canonical(event) + b"\n")
        state["sequence"] = ordinal; state["headSha256"] = event["sha256"]
        (output / "state.json").write_bytes(canonical(state) + b"\n")
        if state["finished"]:
            new_json(output / "completion.json", {"schema": "aperture.blind-judge-public-completion.v1", "judgeId": spec["judgeId"], "eventHeadSha256": state["headSha256"], "eventCount": ordinal, "inputSpecSha256": args.spec_sha256, "originalFinal": file_pin(output / "original-final.json", (output / "original-final.json").read_bytes()), "scope": "Public tool-operation journal only; no model/provider/private reasoning history collected."})
            (output / "events.jsonl").chmod(0o444); (output / "state.json").chmod(0o444)
        sys.stdout.buffer.write(stdout); sys.stdout.buffer.flush()
        sys.stderr.buffer.write(stderr); sys.stderr.buffer.flush()
        return code

if __name__ == "__main__": raise SystemExit(main())
