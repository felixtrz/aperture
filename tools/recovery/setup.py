#!/usr/bin/env python3
"""Ordered, locally resumable recovery stages. Not a dispatch authorization tool."""
import argparse
import contextlib
import fcntl
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import time
import uuid

import cleanup

STAGES = ("pnpm", "dependencies", "build", "runtime", "render")
PNPM = "10.12.1"


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def boot_id():
    return Path("/proc/sys/kernel/random/boot_id").read_text().strip()


def save(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_name(path.name + "." + uuid.uuid4().hex)
    with temp.open("x") as stream:
        json.dump(value, stream, indent=2, sort_keys=True)
        stream.write("\n")
        stream.flush()
        os.fsync(stream.fileno())
    os.replace(temp, path)
    fd = os.open(path.parent, os.O_RDONLY | os.O_DIRECTORY)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


def input_hash(repo):
    paths = [repo / "package.json", repo / "pnpm-lock.yaml", repo / "pnpm-workspace.yaml"]
    paths += sorted((repo / "packages").glob("*/package.json"))
    paths += sorted((repo / "packages").glob("*/src/**/*"))
    paths += sorted((repo / "packages").glob("*/tsconfig*.json"))
    paths += sorted(repo.glob("tsconfig*.json"))
    paths += sorted((repo / "scripts").glob("*.mjs"))
    paths += sorted((repo / "examples").glob("*"))
    paths += [repo / "examples/assets/pisa-studio-rgbe-cube.hdr"]
    paths += sorted((repo / "tools/recovery").glob("*.py"))
    paths += sorted((repo / "tools/recovery").glob("*.mjs"))
    paths += sorted((repo / "tools/recovery/runtime").glob("*"))
    h = hashlib.sha256()
    for path in paths:
        if path.is_file():
            h.update(str(path.relative_to(repo)).encode() + b"\0" + path.read_bytes() + b"\0")
    return h.hexdigest()


def next_stage(state, current_boot, inputs):
    if state and state.get("schema") != 1:
        raise ValueError("unknown recovery progress schema; preserve and reconcile")
    if state.get("boot_id") == current_boot and any(
        r.get("status") == "running" for r in state.get("stages", {}).values()
    ):
        return "reconcile-running-stage"
    if state.get("boot_id") != current_boot or state.get("inputs") != inputs:
        return "pnpm"
    for name in STAGES:
        record = state.get("stages", {}).get(name)
        if record is not None and record.get("status") == "running":
            return "reconcile-running-stage"
        if record is None or record.get("status") != "passed":
            return name
        if not record.get("artifacts"):
            return name
        for path, expected in record["artifacts"].items():
            if not Path(path).is_file() or digest(path) != expected:
                return name
    return "benchmark"


def environment(repo):
    cache = repo / ".aperture-env"
    modules = repo / "node_modules/.modules.yaml"
    if modules.exists():
        stores = [line[len("storeDir: "):].strip() for line in modules.read_text().splitlines()
                  if line.startswith("storeDir: ")]
        if len(stores) != 1:
            raise RuntimeError("existing dependency store is unknown; preserve modules and reconcile")
        candidates = [repo / ".recovery-env", repo / ".aperture-env"]
        matching = [candidate for candidate in candidates
                    if stores[0] == str(candidate / "data/pnpm/store/v10")]
        if len(matching) != 1:
            raise RuntimeError("existing dependency store differs; preserve modules and reconcile")
        cache = matching[0]
    env = os.environ.copy()
    env.update(COREPACK_HOME=str(cache / "corepack"),
               XDG_DATA_HOME=str(cache / "data"), XDG_CACHE_HOME=str(cache / "cache"),
               XDG_STATE_HOME=str(cache / "state"))
    return env


def execute(command, repo, env, cfg, name):
    # Each bootstrap command owns a marked lifecycle; no arbitrary /tmp cleanup.
    with contextlib.ExitStack():
        previous = os.environ.copy()
        previous_cwd = os.getcwd()
        try:
            os.environ.update(env)
            os.chdir(repo)
            code = cleanup.run_command(cfg, "recover-" + name,
                "Repeat this ordered stage from the pinned repository inputs", command)
        finally:
            os.chdir(previous_cwd)
            os.environ.clear()
            os.environ.update(previous)
    if code:
        raise RuntimeError(f"{name}: exit {code}; inspect retained stage/tool output")


def run_stage(name, repo, env, cfg, output):
    corepack = shutil.which("corepack")
    if not corepack:
        raise RuntimeError("corepack is missing; provision the official Node/Corepack tool before dependencies")
    pm = [corepack, "pnpm@" + PNPM]
    if name == "pnpm":
        if json.loads((repo / "package.json").read_text()).get("packageManager") != "pnpm@" + PNPM:
            raise RuntimeError("repository package-manager pin changed; review the recovery recipe")
        execute(pm + ["--version"], repo, env, cfg, name)
        metadata = Path(env["COREPACK_HOME"]) / "v1/pnpm" / PNPM / "package.json"
        if json.loads(metadata.read_text())["version"] != PNPM:
            raise RuntimeError("wrong package-manager version")
        return [metadata]
    if name == "dependencies":
        execute(pm + ["install", "--frozen-lockfile", "--ignore-scripts"], repo, env, cfg, name)
        execute(pm + ["rebuild", "esbuild", "sharp", "protobufjs", "onnxruntime-node"], repo, env, cfg, name)
        execute(["node", str(repo / "node_modules/typescript/bin/tsc"), "--version"], repo, env, cfg, name)
        execute(["node", str(repo / "node_modules/vite/bin/vite.js"), "--version"], repo, env, cfg, name)
        return [repo / "node_modules/.modules.yaml", repo / "node_modules/typescript/package.json"]
    if name == "build":
        execute(pm + ["run", "build"], repo, env, cfg, name)
        paths = sorted((repo / "packages").glob("*/dist/index.js"))
        if len(paths) != 13:
            raise RuntimeError(f"expected 13 built packages, found {len(paths)}")
        return paths
    runtime = repo / ".aperture-env/render-runtime"
    if name == "runtime":
        runtime.mkdir(parents=True, exist_ok=True)
        for filename in ("package.json", "pnpm-lock.yaml"):
            source = repo / "tools/recovery/runtime" / filename
            target = runtime / filename
            if target.exists() and target.read_bytes() != source.read_bytes():
                raise RuntimeError("existing runtime input differs; preserve it and reconcile")
            if not target.exists():
                target.write_bytes(source.read_bytes())
        execute(pm + ["--dir", str(runtime), "--ignore-workspace", "install", "--frozen-lockfile", "--ignore-scripts", "--package-import-method=copy"], repo, env, cfg, name)
        return [runtime / "pnpm-lock.yaml", runtime / "node_modules/playwright-core/package.json",
                runtime / "node_modules/@sparticuz/chromium/package.json"]
    if name == "render":
        env = dict(env, APERTURE_WEBGPU_RUNTIME=str(runtime))
        command = [sys.executable, "-B", str(repo / "tools/recovery/runtime_pressure.py"),
                   "--root", cfg.root, "--audit-dir", cfg.audit_dir, "run", "--job", "recovery-webgpu-proof",
                   "--recreation", "Run the committed recovery render through runVerifiedScene", "--",
                   "node", str(repo / "tools/recovery/render.mjs"), str(output)]
        result = subprocess.run(command, cwd=repo, env=env, check=False)
        if result.returncode:
            raise RuntimeError(f"verified renderer/lifecycle failed: exit {result.returncode}")
        report = output / "result.json"
        data = json.loads(report.read_text())
        if data.get("status") != "passed" or not data.get("proof", {}).get("native") or data["proof"].get("webglAttempts") != 0:
            raise RuntimeError("native WebGPU proof missing")
        return [report, output / "render.png"]
    raise ValueError(name)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["status", "advance"])
    parser.add_argument("--repo", type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument("--scratch-root", default=cleanup.RECOVERY_ROOT)
    parser.add_argument("--allow-new-root", action="store_true", help="Only after verified VM loss/approved new setup")
    args = parser.parse_args()
    repo = args.repo.resolve()
    state_path = repo / ".aperture-env/recovery-state.json"
    state = json.loads(state_path.read_text()) if state_path.exists() else {}
    inputs, boot = input_hash(repo), boot_id()
    selected = next_stage(state, boot, inputs)
    if args.command == "status":
        print(json.dumps({"next_stage": selected, "boot_id": boot, "inputs": inputs, "dispatch_authorized": False}))
        return 0
    state_path.parent.mkdir(exist_ok=True)
    lock_path = state_path.parent / "recovery.lock"
    with lock_path.open("a+") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise RuntimeError("another recovery stage is active; observe it, do not replace it")
        state = json.loads(state_path.read_text()) if state_path.exists() else {}
        selected = next_stage(state, boot, inputs)
        if selected == "benchmark":
            print(json.dumps({"next_stage": "benchmark", "setup_verified": True}))
            return 0
        if selected == "reconcile-running-stage":
            raise RuntimeError("running/ambiguous stage requires tool and descendant reconciliation before retry")
        if state.get("boot_id") != boot or state.get("inputs") != inputs:
            if state:
                save(state_path.with_name("previous-" + uuid.uuid4().hex + ".json"), state)
            state = {"schema": 1, "boot_id": boot, "inputs": inputs, "stages": {}}
        output = repo / "benchmarks/evidence/staging" / ("recovery-" + uuid.uuid4().hex)
        output.mkdir(parents=True)
        cfg = cleanup.Config(str(Path(args.scratch_root).absolute()), str(output / "lifecycle-audits"))
        if not Path(cfg.root).exists():
            if not args.allow_new_root:
                raise RuntimeError("marked scratch root missing; confirm verified-loss recovery before creating it")
            cleanup.initialize(cfg)
        with cleanup.Store(cfg):
            pass
        state["stages"][selected] = {"status": "running", "started_at": time.time(), "pid": os.getpid(), "output": str(output)}
        save(state_path, state)
        try:
            artifacts = run_stage(selected, repo, environment(repo), cfg, output)
            state["stages"][selected].update(status="passed", finished_at=time.time(),
                artifacts={str(p): digest(p) for p in artifacts})
        except BaseException as exc:
            # An exception is not proof of quiescence. Parent must reconcile.
            state["stages"][selected].update(status="running", observed_error=str(exc))
            save(state_path, state)
            save(output / "stage-receipt.json", state["stages"][selected])
            raise
        save(state_path, state)
        save(output / "stage-receipt.json", state["stages"][selected])
        print(json.dumps({"cleared": selected, "next_stage": next_stage(state, boot, inputs), "evidence": str(output)}))
        return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(json.dumps({"blocked": str(exc), "dispatch_authorized": False}), file=sys.stderr)
        raise SystemExit(2)
