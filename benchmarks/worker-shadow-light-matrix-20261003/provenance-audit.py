"""Read-only actual-byte audit; unlike git diff, includes worktree-untracked files."""
import hashlib
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent.parent
COMMIT = "d0333acdd4443ed9a4a0239d24184755b812b447"
component = json.loads((ROOT.parent / "native-shadow-light-matrix-v2-20261003/source-pins.json").read_text())
entries = subprocess.check_output(["git", "ls-tree", "-rz", COMMIT, "--", "packages"], cwd=REPO).split(b"\0")
checked, mismatches = [], []
for entry in entries:
    if not entry:
        continue
    metadata, raw_name = entry.split(b"\t", 1)
    mode, kind, expected = metadata.decode().split()
    name = raw_name.decode()
    if kind != "blob" or ("/src/" not in name and not name.endswith("/package.json")):
        continue
    data = (REPO / name).read_bytes()
    actual = hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest()
    record = {"path": name, "gitBlob": expected, "actualGitBlob": actual, "sha256": hashlib.sha256(data).hexdigest(), "bytes": len(data)}
    checked.append(record)
    if actual != expected:
        mismatches.append(name)
retained = []
for name, expected in component["files"].items():
    data = (REPO / name).read_bytes()
    if len(data) != expected["bytes"] or hashlib.sha256(data).hexdigest() != expected["sha256"]:
        mismatches.append(name)
    retained.append(name)
result = {"status": "failed" if mismatches else "passed", "engineSourceCommit": COMMIT,
          "sourceFiles": checked, "retainedPinCount": len(retained), "mismatches": sorted(set(mismatches)),
          "compiledProvenance": "Actual compiled files equal retained native component pins. No new build or engine edit performed.",
          "localHeadUsedAsEngineProvenance": False}
with (ROOT / "engine-provenance.json").open("x") as stream:
    json.dump(result, stream, indent=2)
    stream.write("\n")
print(json.dumps({"status": result["status"], "sourceFileCount": len(checked), "retainedPinCount": len(retained), "mismatches": result["mismatches"]}))
raise SystemExit(bool(mismatches))
