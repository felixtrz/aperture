#!/usr/bin/env python3
"""Offline native-image equality gates. Never starts a browser or server."""
import argparse
import hashlib
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent
MODES = ("directional", "cascaded", "spot", "point")
STATES = ("baseline", "noop", "vertices", "vertices-noop", "vertex-reset", "indices", "indices-noop", "index-reset", "reset-noop")
SHAPES = ("baseline", "vertices", "indices")


def difference(a, b):
    if a.size != b.size:
        raise ValueError("Image dimensions differ")
    count, maximum, bounds = 0, 0, None
    width = a.width
    for index, (left, right) in enumerate(zip(a.convert("RGB").getdata(), b.convert("RGB").getdata())):
        delta = max(abs(x - y) for x, y in zip(left, right))
        if delta:
            count += 1
            maximum = max(maximum, delta)
            x, y = index % width, index // width
            bounds = [x, y, x, y] if bounds is None else [min(bounds[0], x), min(bounds[1], y), max(bounds[2], x), max(bounds[3], y)]
    return {"differentPixels": count, "maximumChannelDifference": maximum, "boundsInclusive": bounds}


def read_capture(directory, state):
    path = directory / f"{state}.png"
    image = Image.open(path)
    image.load()
    if image.size != (512, 512) or len(image.convert("RGB").getcolors(512 * 512) or []) < 2:
        raise ValueError(f"Blank or wrong-size native image: {path}")
    if image.convert("RGBA").getextrema()[3] != (255, 255):
        raise ValueError(f"Transparent native image: {path}")
    return image


def verify_attempt(directory):
    outcome = json.loads((directory / "outcome.json").read_text())
    proof = json.loads((directory / "verified-runner.json").read_text())
    if outcome["status"] != "passed" or proof["status"] != "passed":
        raise ValueError(f"Native attempt did not pass: {directory}")
    for receipt in json.loads((directory / "receipts.json").read_text()):
        name = receipt["path"]
        if Path(name).name != name:
            raise ValueError("Receipt escapes attempt")
        data = (directory / name).read_bytes()
        if len(data) != receipt["bytes"] or hashlib.sha256(data).hexdigest() != receipt["sha256"]:
            raise ValueError(f"Receipt bytes changed: {directory / name}")
    return json.loads((directory / "inputs.json").read_text())["sourcePinsSha256"]


def compare_matrix(attempt, modes=MODES):
    result, source_pins = {}, set()
    for mode in modes:
        live = ROOT / "renders" / mode / "live" / attempt
        source_pins.add(verify_attempt(live))
        images = {state: read_capture(live, state) for state in STATES}
        fresh = {}
        for shape in SHAPES:
            directory = ROOT / "renders" / mode / f"fresh-{shape}" / attempt
            source_pins.add(verify_attempt(directory))
            fresh[shape] = read_capture(directory, shape)
            live_record = json.loads((live / f"{shape}.json").read_text())
            fresh_record = json.loads((directory / f"{shape}.json").read_text())
            for location in ("streams", "indexBuffer", "submeshes", "localAabb", "localSphere"):
                if live_record["sourceMesh"][location] != fresh_record["sourceMesh"][location]:
                    raise ValueError(f"Live/fresh source mesh differs for {mode}/{shape}/{location}")
        checks = []
        for state in STATES:
            shape = "vertices" if state.startswith("vertices") else "indices" if state.startswith("indices") else "baseline"
            delta = difference(images[state], fresh[shape])
            checks.append({"left": state, "right": f"fresh-{shape}", "expected": "equal", **delta, "ok": delta["differentPixels"] == 0})
        for shape in ("vertices", "indices"):
            delta = difference(images["baseline"], images[shape])
            checks.append({"left": "baseline", "right": shape, "expected": "different", **delta, "ok": delta["differentPixels"] > 0})
        result[mode] = {"passed": all(check["ok"] for check in checks), "checks": checks}
    if len(source_pins) != 1:
        raise ValueError("Attempts use different source pins")
    return {"status": "passed" if all(value["passed"] for value in result.values()) else "failed", "attempt": attempt, "modes": result, "sourcePinsSha256": source_pins.pop(), "scope": "Exact native live/fresh/reset image equality and visible edit sensitivity; no score, per-light pixel-occlusion attribution, performance or GPU-memory claim."}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("attempt")
    parser.add_argument("output", help="New JSON filename inside this fixture directory")
    parser.add_argument("--mode", choices=MODES)
    args = parser.parse_args()
    if not __import__("re").fullmatch(r"attempt-[0-9]{3}", args.attempt) or Path(args.output).name != args.output or not args.output.endswith(".json"):
        parser.error("Expected attempt-NNN and a new JSON filename")
    try:
        result = compare_matrix(args.attempt, (args.mode,) if args.mode else MODES)
    except Exception as error:
        result = {"status": "failed", "attempt": args.attempt, "error": str(error)}
    with (ROOT / args.output).open("x") as output:
        json.dump(result, output, indent=2)
        output.write("\n")
    print(json.dumps(result))
    return result["status"] != "passed"


if __name__ == "__main__":
    raise SystemExit(main())
