#!/usr/bin/env python3
"""Prepare fresh, reproducible author lanes without activating or dispatching them.

Packing consumes already built package output. This script does not build the
repository, generate the reference corpus, launch a browser, or start authors.
"""

from __future__ import annotations

import argparse
import datetime as dt
import gzip
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tarfile
import time


ROOT = Path(__file__).resolve().parents[2]
PRIVATE = ROOT / ".aperture-env/agent-house-race"
EVIDENCE = ROOT / "benchmarks/agent-house-race-20261011"
REFERENCE = EVIDENCE / "reference.png"
EXPECTED_REFERENCE_SHA256 = "0f28db644bd9bb627495272fd4102b45c5e2f3ffecf8a71ef169daf8096999fa"
IMAGE = "aperture-author-node:20261011"
PNPM = ["npx", "--yes", "pnpm@10.12.1"]
PUBLISHABLE = (
    "app", "audio", "cli", "math", "particles", "physics", "physics-rapier",
    "reference-assets", "render", "runtime", "simulation", "ui", "vite-plugin", "webgpu",
)
DOCS = (
    "AUTHORING.md", "VISUAL_QUALITY.md", "BROWSER_FRAME_CONTROL.md", "AI_TOOLING.md",
    "ARCHITECTURE.md", "DECISIONS.md", "AGENT_AUTHORING_BASELINE.md", "MIXED_SHADOWS.md",
    "RENDERED_GEOMETRY_INSPECTION.md", "HEADLESS_SOURCE_REALMS.md",
)
PACKAGE_ROOT_FILES = ("package.json", "README.md", "ASSETS.md", "LICENSE", "CHANGELOG.md", "tsconfig.json")
SETUP_INPUTS = (
    "tools/agent-benchmark/prepare-round.py", "tools/agent-benchmark/PREPARE_ROUND.md",
    "tools/agent-benchmark/README.md", "tools/agent-benchmark/AUTHOR_TRANSCRIPTS.md",
    "tools/agent-benchmark/PREVIEW_V2.md", "tools/agent-benchmark/PREVIEW_V3.md",
    "tools/agent-benchmark/preview-service-v3.py", "tools/agent-benchmark/preview-run-v3.mjs",
    "tools/agent-benchmark/preview-client-v3.mjs", "tools/agent-benchmark/preview-geometry-v3.mjs",
    "tools/agent-benchmark/author-lane.py",
    "tools/agent-benchmark/audit-authors.py", "tools/agent-benchmark/preview-service-v2.py",
    "tools/agent-benchmark/preview-run.mjs", "tools/agent-benchmark/preview-client.mjs",
    "tools/agent-benchmark/run.mjs", "tools/agent-benchmark/client.mjs",
    "tools/agent-benchmark/contract.mjs", "tools/agent-benchmark/native-observer.mjs",
    "tools/agent-benchmark/recorder.mjs", "tools/agent-benchmark/summarize.mjs",
    "tools/agent-benchmark/score-round.mjs", "tools/agent-benchmark/score-quality.mjs",
    "tools/agent-benchmark/score-stability.mjs", "tools/agent-benchmark/SCORE_ROUND.md",
    "tools/agent-benchmark/run-v2.mjs", "tools/agent-benchmark/client-v2.mjs",
    "tools/agent-benchmark/indirect-args-v2.mjs", "tools/agent-benchmark/triangle-accounting-v2.mjs",
    "tools/agent-benchmark/protocol-v2.mjs", "tools/agent-benchmark/geometry-codec-v2.mjs",
    "tools/agent-benchmark/geometry-data-v2.mjs", "tools/agent-benchmark/geometry-capture-v2.mjs",
    "tools/agent-benchmark/geometry-evidence-v2.mjs", "tools/agent-benchmark/position-parity-v2.mjs",
    "tools/agent-benchmark/native-observer-v2.mjs", "tools/agent-benchmark/upload-segments-v2.mjs",
    "tools/agent-benchmark/recorder-v2.mjs", "tools/agent-benchmark/GEOMETRY_V2.md",
    "tools/agent-benchmark/official-trials-v2.py",
    "tools/recovery/runtime_pressure.py", "scripts/verified-webgpu.mjs",
    "tools/recovery/cleanup.py", "tools/recovery/pressure_cache_retirement.py",
    "tools/agent-benchmark/capacity.py", "tools/agent-benchmark/capacity_budget.py",
    "tools/agent-benchmark/CAPACITY.md",
    "tools/agent-benchmark/record-judge-v3.py", "tools/agent-benchmark/judge_image_v3.py",
    "tools/agent-benchmark/live-image-response-v3.mjs", "tools/agent-benchmark/prepare-judge-v3.py",
    "tools/agent-benchmark/JUDGE_V3.md",
    "scripts/local-webgpu.mjs", "docs/CLOUD_LOCAL_RENDERING.md",
)
EXCLUDED_PARTS = {"test", "tests", "__tests__", "benchmark", "benchmarks", "node_modules", ".git"}

# This brief is shared byte-for-byte. Engine resources and recorder lane/path
# substitutions are appended separately; no prior result or scene advice enters it.
COMMON_PROMPT = """Build a polished, moderately detailed, genuinely three-dimensional scene matching the supplied reference image. Author the house exterior with ivory stucco, terracotta tiled gable roof and chimney, dark framed inset windows, covered front porch with two posts and a door, stone path, low stone garden boundary, shrubs/trees, mailbox, curved asphalt road across the foreground and right side with curbs and broken white markings, and a blue hatchback with four wheels, body contour, glass windows, lights and trim. The distant landscape is optional. Match the warm daylight and composition. Details should remain convincing from other views. Geometry, materials, procedural textures, instancing and batching are allowed. Do not use the reference image as a texture, background or billboard; do not bake the scene into a picture. No external ready-made house/car scene or image-generation tool. You may use public assigned-engine docs and inspect its installed source.

Use only your assigned engine's actual native WebGPU renderer, with no WebGL fallback or third-party renderer. Use the common interface below. Do not alter native APIs, fake measurements or introduce timing delays. Real submitted geometry must be returned by inspectGeometry. Every visible mesh and instance must be represented. Use deterministic scene generation. If you use procedural randomness, use a fixed seed; fresh browser instances must reproduce the same geometry. Do not add an animation loop after registration. Supply a buildable Vite application with `pnpm run build` producing /work/dist.

Final trials use the same binary geometry v2 protocol for both engines: 60 warmup and 120 measured frames, followed by lossless geometry export and the same three cameras. Return owned coherent numeric arrays rather than live SharedArrayBuffer views. All positions, indices, normals, world/instance matrices and instance multiplicity are retained; ordinary Number arrays use Float64LE and typed arrays retain their dtype. Source numeric chunks are at most 4 MiB with a 256 MiB total, native upload parts at most 4 MiB with a 64 MiB total, and manifests at most 8 MiB. The observer retains final nonoverlapping native upload bytes through all measured frames, so common byte-copy instrumentation is included in CPU timings. Capture failures preserve measured samples and invalidate the trial. Native triangle accounting uses the same v2.1 policy for both engines: proven complete owned CPU-written indirect argument spans are decoded at native submit; storage, unknown GPU mutations and unreadable arguments remain explicitly unknown lower bounds. Full raw argument witnesses are deduplicated with per-frame multiplicity. Metadata capacity failure invalidates the attempt after preserving measured samples. No GPU readback or engine-reported count is substituted. Both engines receive an identical finite 1800000 ms verifier readiness/navigation deadline, not a strict whole-process timeout; controlled frame/fence waits and awaited cleanup remain required. Authors implement the same adapter and do not import or alter the harness.

You have 1800 seconds of active authoring budget, beginning when you call start. Dependency installation has already been completed. The recorder separately retains raw wall time and renderer waiting time. You may request at most three previews using the recorder; the coordinator returns only your own canvas views or actual runtime errors, without implementation advice. Preview waiting is credited equally. Each preview freezes your existing /work/dist at request time, then queues that exact build. Build before requesting a preview. Successful previews use three warmup frames, three short diagnostic frames and the same three fixed camera views (nine render requests total). Both engines receive the same numeric geometry export preflight after the six canonical frames: inspectGeometry must return owned coherent supported numeric arrays with valid triangle indices and affine world/instance matrices, within the same 256 MiB source, 4 MiB chunk, 8 MiB numeric descriptor and aggregate work limits. Preview preflight discards numeric arrays after validation and reports only counts/status or actual export errors. It adds no render requests or queue fences. A preflight failure stops the preview and returns the actual error. A valid partial export can pass this numeric check; full visible coverage, native upload parity, final complete manifest size and official eligibility remain separate final-trial checks. Full scoring uses separate final-build trials. A preview wait deadline can expire while the coordinator is still working. Use feedback with that preview number to retrieve its existing response; this spends no additional preview. Runtime error text is returned inline with its full artifact hash. When finished, stop all application processes, build the final app, record a public note describing your implementation and any limitations, and call finish. After finish, make no edits.

Infrastructure may use a frozen common capacity policy. Operational reserves are conditional estimates, not quotas or lower scene limits. Actual byte sizes and free space are checked before author start and every native request. Only exact registered completed Chromium caches may retire after observed shutdown; original lifecycle receipts remain preserved. Maintenance runs outside measured frames, and verified preview waiting retains equal credit. Capacity incidents preserve original requests/counts; there are no automatic retries or budget resets.

Isolation and operational transcript rules: You start with no inherited chat. Do not contact other agents, use collaboration tools, inspect other workspaces, history, root repository, benchmark results, private provider/session data, or environment credentials. All searches, reads, shell commands and edits MUST run through the exact recorder command below. It invokes your command inside your assigned container at /work. Do not call apply_patch or unrecorded host exec commands. Use ordinary Python/Node/heredocs inside that recorded command to edit files. You can inspect the supplied image and returned preview PNGs with view_image; log each image inspection with recorder note. Do not dump the process environment or access secrets. Tools are routed cooperatively; the command container enforces filesystem separation. No browser launches, dev servers left running, Playwright installs, sandbox/flag changes or alternate rendering routes. Preview is the available browser tool.
"""


class PreparationError(Exception):
    pass


def require(value, message):
    if not value:
        raise PreparationError(message)


def utc_now():
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="microseconds")


def digest(data):
    return hashlib.sha256(data).hexdigest()


def json_bytes(value):
    return (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def record(path, relative_to=None):
    data = path.read_bytes()
    return {"path": path.relative_to(relative_to).as_posix() if relative_to else path.name,
            "bytes": len(data), "sha256": digest(data)}


def create_file(path, data, readonly=False):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("xb") as stream:
        stream.write(data)
        stream.flush()
        os.fsync(stream.fileno())
        if readonly:
            os.fchmod(stream.fileno(), 0o444)


def copy_file(source, destination, origins):
    require(source.is_file() and not source.is_symlink(), f"Required regular input is missing: {source.relative_to(ROOT)}")
    data = source.read_bytes()
    create_file(destination, data)
    origins.append({"source": source.relative_to(ROOT).as_posix(), "destination": str(destination),
                    "bytes": len(data), "sha256": digest(data)})


def public_file(relative):
    return not any(part in EXCLUDED_PARTS for part in relative.parts) and not re.search(r"\.(?:test|spec|bench)\.", relative.name)


def copy_tree(source, destination, origins):
    require(source.is_dir() and not source.is_symlink(), f"Required directory is missing: {source.relative_to(ROOT)}")
    for path in sorted(source.rglob("*")):
        relative = path.relative_to(source)
        if not public_file(relative):
            continue
        require(not path.is_symlink(), f"Public input contains a symbolic link: {path.relative_to(ROOT)}")
        if path.is_file():
            copy_file(path, destination / relative, origins)


def readonly_tree(root):
    for path in sorted(root.rglob("*"), reverse=True):
        path.chmod(0o555 if path.is_dir() else 0o444)
    root.chmod(0o555)


def repository_inputs():
    inputs = {ROOT / relative for relative in SETUP_INPUTS}
    inputs.update((EVIDENCE / "method.json", REFERENCE))
    inputs.update(ROOT / "docs" / name for name in DOCS)
    for name in PUBLISHABLE:
        package = ROOT / "packages" / name
        inputs.update(package / filename for filename in PACKAGE_ROOT_FILES if (package / filename).is_file())
        for directory in ("src", "dist"):
            source = package / directory
            if source.is_dir():
                inputs.update(path for path in source.rglob("*") if path.is_file() and public_file(path.relative_to(source)))
    source = ROOT / "docs-site/src"
    inputs.update(path for path in source.rglob("*") if path.is_file() and public_file(path.relative_to(source)))
    return {path.relative_to(ROOT).as_posix(): {"bytes": path.stat().st_size, "sha256": record(path)["sha256"]}
            for path in sorted(inputs)}


def run(command, *, cwd=ROOT, env=None, timeout=600, private_log=None):
    started = time.monotonic()
    result = subprocess.run(command, cwd=cwd, env=env, capture_output=True, timeout=timeout, check=False)
    if private_log:
        create_file(private_log, result.stdout + b"\n" + result.stderr)
    require(result.returncode == 0, f"Setup operation failed ({command[0]}); partial artifacts are retained, no lane was activated")
    return result.stdout, time.monotonic() - started


def docker_env():
    env = os.environ.copy()
    for key in ("DOCKER_HOST", "DOCKER_CONTEXT", "DOCKER_TLS", "DOCKER_TLS_VERIFY", "DOCKER_CERT_PATH"):
        env.pop(key, None)
    return env


def docker(args, **kwargs):
    return run(["docker", "--host=unix:///var/run/docker.sock", *args], env=docker_env(), **kwargs)


def paths(round_number):
    round_id = f"round-{round_number:03d}"
    return {"round": round_id, "sdk": PRIVATE / "sdk" / round_id,
            "lanes": PRIVATE / "lanes" / round_id, "public": EVIDENCE / round_id,
            "pending": PRIVATE / "control" / f"lanes-r{round_number:03d}.pending.json",
            "privateLogs": PRIVATE / "control" / f"setup-r{round_number:03d}-logs"}


def preflight(round_number, validation, reference_evidence):
    output = paths(round_number)
    for key in ("sdk", "lanes", "public", "pending", "privateLogs"):
        require(not output[key].exists(), f"Create-only destination already exists: {output[key]}")
    require(digest(REFERENCE.read_bytes()) == EXPECTED_REFERENCE_SHA256, "Shared reference differs from the frozen original")
    method = json.loads((EVIDENCE / "method.json").read_bytes())
    require(method["authorBudgetSeconds"] == 1800 and method["previewAllowance"] == 3 and method["trialsPerEngine"] == 3,
            "Shared method budget, preview allowance or trial count differs")
    require(method["referenceSha256"] == EXPECTED_REFERENCE_SHA256 and method["engines"]["three"] == "0.186.1",
            "Shared method reference or Three.js version differs")
    for receipt in (validation, reference_evidence):
        require(receipt.is_file() and not receipt.is_symlink(), "Root-reviewed validation/reference evidence is required")
    ca = PRIVATE / "public-ca/proxy-ca.pem"
    require(ca.is_file() and not ca.is_symlink(), "Public proxy CA is missing")
    for name in PUBLISHABLE:
        package = ROOT / "packages" / name
        manifest = json.loads((package / "package.json").read_bytes())
        require(manifest.get("name") == "@aperture-engine/" + name and manifest.get("private") is not True,
                "Publishable package identity differs")
        require((package / "dist").is_dir(), f"Build output is missing for {name}; setup never builds it")
    for doc in DOCS:
        require((ROOT / "docs" / doc).is_file(), f"Public documentation is missing: {doc}")
    for relative in SETUP_INPUTS:
        require((ROOT / relative).is_file(), f"Setup input is missing: {relative}")
    return output


def pack_sdk(sdk, logs, origins):
    packages = sdk / "packages"
    packages.mkdir()
    env = os.environ.copy()
    env["npm_config_ignore_scripts"] = "true"
    dependencies = {}
    pack_receipts = []
    for name in PUBLISHABLE:
        package = ROOT / "packages" / name
        for filename in PACKAGE_ROOT_FILES:
            if (package / filename).is_file():
                copy_file(package / filename, sdk / "source" / name / filename, origins)
        for directory in ("src", "dist"):
            if (package / directory).is_dir():
                copy_tree(package / directory, sdk / "source" / name / directory, origins)
        manifest = json.loads((package / "package.json").read_bytes())
        filename = f"aperture-engine-{name}-{manifest['version']}.tgz"
        command = [*PNPM, "--config.ignore-scripts=true", "--filter", manifest["name"], "pack", "--json", "--pack-destination", str(packages)]
        _, elapsed = run(command, env=env, private_log=logs / f"pack-{name}.log")
        packed = packages / filename
        require(packed.is_file(), f"Packed filename differs for {name}")
        # Inspect the actual packed metadata, not pnpm's human-readable output.
        with tarfile.open(packed, "r:gz") as archive:
            member = archive.extractfile("package/package.json")
            require(member is not None, "Packed package metadata is missing")
            packed_manifest = json.loads(member.read())
            require(packed_manifest["name"] == manifest["name"] and packed_manifest["version"] == manifest["version"],
                    "Packed package identity differs")
            packed_dist = set()
            for entry in archive.getmembers():
                if not entry.name.startswith("package/dist/") or entry.isdir():
                    continue
                require(entry.isfile(), "Packed build output must contain only regular files")
                relative = Path(entry.name).relative_to("package/dist")
                copied = sdk / "source" / name / "dist" / relative
                require(copied.is_file() and archive.extractfile(entry).read() == copied.read_bytes(),
                        f"Packed build and retained source disagree for {name}/{relative}")
                packed_dist.add(relative.as_posix())
            source_dist = sdk / "source" / name / "dist"
            require(packed_dist == {path.relative_to(source_dist).as_posix() for path in source_dist.rglob("*") if path.is_file()},
                    f"Packed build inventory differs for {name}")
        dependencies[manifest["name"]] = "file:/sdk/packages/" + filename
        pack_receipts.append({"package": manifest["name"], "command": command[:-1] + ["<own-sdk>/packages"],
                              "elapsedSeconds": elapsed, **record(packed, sdk)})
    for doc in DOCS:
        copy_file(ROOT / "docs" / doc, sdk / "docs" / doc, origins)
    copy_tree(ROOT / "docs-site/src", sdk / "docs-site-src", origins)
    return dependencies, pack_receipts


def prompt(engine, lane_id, public, contract):
    engine_brief = {
        "three": "Assigned engine: Three.js 0.186.1. Use WebGPURenderer from three/webgpu and forceWebGL:false. Installed dependencies are your public source; official documentation may be fetched by recorded commands. No Aperture resources are provided.",
        "aperture": "Assigned engine: Aperture, current working-tree SDK snapshot. Dependencies are preinstalled from /sdk/packages. Public docs and package sources are read-only at /sdk/docs, /sdk/docs-site-src and /sdk/source. CLI is installed. Follow the normal simulation worker, ECS, extraction snapshot and main-thread WebGPU design. Do not bypass this with a main-thread authoritative scene or another renderer.",
    }[engine]
    operations = f"""
The only host command entrypoint is:
`python3 -B {ROOT}/tools/agent-benchmark/author-lane.py {lane_id} ACTION [TEXT]`
Actions: start; note PUBLIC_TEXT; exec SHELL_SCRIPT; preview; feedback PREVIEW_NUMBER; finish. Quote each shell script as one argument. This records the exact script, stdout, stderr, timestamps and exit status. A command process group is stopped at command end, so a background server cannot persist between commands. You should use functions.exec -> tools.exec_command only with this entrypoint (including no extra shell operations). Capture all failures and retries. The prompt/reference hashes and source hashes are recorded. These are visible operational records, never private reasoning.

Reference image for view_image: {public}/reference.png
Assigned container workspace /work. Common interface available /reference/contract.md. Reference is /reference/reference.png. Your own prompt is /reference/prompt.txt.
"""
    return engine_brief + "\n\n" + COMMON_PROMPT + operations + "\n" + contract


def starter(engine, dependencies):
    return {
        "package.json": json_bytes({"name": "house-" + engine, "version": "1.0.0", "private": True,
                                    "type": "module", "packageManager": "pnpm@10.12.1", "scripts": {"build": "vite build"},
                                    "devDependencies": {"vite": "8.0.16", "typescript": "6.0.3", "prettier": "3.8.3"},
                                    "dependencies": dependencies, "pnpm": {"overrides": dependencies if engine == "aperture" else {}}}),
        "index.html": b'<!doctype html>\n<html><head><meta charset="UTF-8"><title>House scene</title></head><body style="margin:0"><script type="module" src="/src/main.js"></script></body></html>\n',
        "src/main.js": b'// Build the assigned scene and register the benchmark adapter here.\n',
        ".npmrc": b'store-dir=/opt/aperture-pnpm-store\n',
    }


def archive_sdk(sdk, destination):
    # Deterministic archive metadata retains byte identity without host ownership
    # or timestamps. The manifest inside records the actual snapshot provenance.
    with destination.open("xb") as raw:
        with gzip.GzipFile(filename="", mode="wb", fileobj=raw, mtime=0) as compressed:
            with tarfile.open(fileobj=compressed, mode="w", format=tarfile.PAX_FORMAT) as archive:
                for path in [sdk, *sorted(sdk.rglob("*"))]:
                    info = archive.gettarinfo(str(path), arcname="sdk" + ("/" + path.relative_to(sdk).as_posix() if path != sdk else ""))
                    info.uid = info.gid = info.mtime = 0
                    info.uname = info.gname = ""
                    info.mode = 0o555 if path.is_dir() else 0o444
                    if path.is_file():
                        with path.open("rb") as stream:
                            archive.addfile(info, stream)
                    else:
                        archive.addfile(info)


def artifact_protocol():
    raw, _ = run(["node", "--input-type=module", "-e", "import { ARTIFACT_PROTOCOL_V2 } from './tools/agent-benchmark/protocol-v2.mjs'; process.stdout.write(JSON.stringify(ARTIFACT_PROTOCOL_V2))"], timeout=30)
    value = json.loads(raw)
    require(value.get("schema") == "aperture.agent-house-artifacts.v2", "Fresh preparation requires binary geometry v2")
    return value


def prepare(round_number, validation, reference_evidence, capacity_record=None, preparation_capacity_record=None):
    require(bool(capacity_record) == bool(preparation_capacity_record), "Both preparation and author capacity policies are required together")
    output = preflight(round_number, validation, reference_evidence)
    input_hashes = repository_inputs()
    protocol = artifact_protocol()
    suffix = f"r{round_number:03d}"
    names = [f"aperture-house-{engine}-{suffix}" for engine in ("three", "aperture")]
    existing, _ = docker(["ps", "-a", "--format", "{{.Names}}"], timeout=30)
    require(not any(name in existing.decode("utf-8").splitlines() for name in names), "A fresh container name already exists")
    image_raw, _ = docker(["image", "inspect", "--format", "{{.Id}}", IMAGE], timeout=30)
    image_id = image_raw.decode("utf-8").strip()
    require(re.fullmatch(r"sha256:[a-f0-9]{64}", image_id), "Pinned author image identity is invalid")
    base_head, _ = run(["git", "rev-parse", "HEAD"], timeout=30)
    setup = output["public"] / "setup"
    setup.mkdir(parents=True)
    capacity_before = None
    if preparation_capacity_record is not None:
        from capacity import Policy
        capacity_before = Policy.load(preparation_capacity_record["path"], preparation_capacity_record["sha256"]).phase_admission(str(setup / "capacity-before-preparation"))
        create_file(setup / "capacity-preparation-policy.json", Path(preparation_capacity_record["path"]).read_bytes(), readonly=True)
    if capacity_record is not None:
        from capacity import Policy
        create_file(setup / "capacity-policy.json", Path(capacity_record["path"]).read_bytes(), readonly=True)
        capacity_record = {"path": str(setup / "capacity-policy.json"), "sha256": capacity_record["sha256"]}
    output["sdk"].mkdir(parents=True)
    output["lanes"].mkdir(parents=True)
    output["privateLogs"].mkdir(parents=True)
    origins = []
    for relative in SETUP_INPUTS:
        copy_file(ROOT / relative, setup / "sources" / relative, origins)
    copy_file(EVIDENCE / "method.json", setup / "method.json", origins)
    copy_file(REFERENCE, setup / "reference.png", origins)
    create_file(setup / "common-prompt.txt", COMMON_PROMPT.encode("utf-8"))
    create_file(setup / "validation-evidence" / validation.name, validation.read_bytes())
    create_file(setup / "reference-evidence" / reference_evidence.name, reference_evidence.read_bytes())
    dependencies, packs = pack_sdk(output["sdk"], output["privateLogs"], origins)
    sdk_snapshot = {"schema": "aperture.sdk-working-tree-snapshot.v1", "createdAt": utc_now(),
                    "baseGitHead": base_head.decode().strip(),
                    "provenance": "Already built current working-tree files and public docs, packed with lifecycle scripts disabled; not a new Git commit. Root supplied the separately reviewed validation and reference-producer evidence.",
                    "files": [record(path, output["sdk"]) for path in sorted(output["sdk"].rglob("*")) if path.is_file()],
                    "packs": packs}
    create_file(output["sdk"] / "snapshot.json", json_bytes(sdk_snapshot))
    create_file(setup / "sdk-snapshot.json", json_bytes(sdk_snapshot))
    readonly_tree(output["sdk"])
    archive_sdk(output["sdk"], setup / "sdk-snapshot.tar.gz")
    contract = (ROOT / "tools/agent-benchmark/README.md").read_text().split("## Execution and scope", 1)[0].rstrip() + "\n\n" + (ROOT / "tools/agent-benchmark/GEOMETRY_V2.md").read_text()
    config = {"schema": "aperture.author-lanes.v1", "transcriptRoot": str(output["public"] / "authors"), "lanes": {}}
    if capacity_record is not None:
        config["capacityPolicy"] = capacity_record
    containers = []
    for engine in ("three", "aperture"):
        lane_id = f"{engine}-{suffix}"
        lane_root = output["lanes"] / engine
        public, work = lane_root / "public", lane_root / "work"
        public.mkdir(parents=True)
        work.mkdir()
        create_file(public / "reference.png", REFERENCE.read_bytes())
        create_file(public / "contract.md", contract.encode("utf-8"))
        author_prompt = prompt(engine, lane_id, public, contract).encode("utf-8")
        create_file(public / "prompt.txt", author_prompt)
        create_file(setup / "prompts" / f"{engine}.txt", author_prompt)
        assigned_dependencies = dependencies if engine == "aperture" else {"three": "0.186.1"}
        for relative, data in starter(engine, assigned_dependencies).items():
            create_file(work / relative, data)
            create_file(setup / "starters" / engine / relative, data)
        readonly_tree(public)
        mounts = [{"source": str(public), "target": "/reference"},
                  {"source": str(PRIVATE / "public-ca/proxy-ca.pem"), "target": "/run/proxy-ca.pem"}]
        if engine == "aperture":
            mounts.append({"source": str(output["sdk"]), "target": "/sdk"})
        container = f"aperture-house-{engine}-{suffix}"
        lane = {"engine": engine, "container": container, "workspace": str(work), "budgetSeconds": 1800,
                "commandDeadlineSeconds": 600, "promptPath": str(public / "prompt.txt"),
                "referencePath": str(public / "reference.png"), "readOnlyMounts": mounts,
                "buildDirectory": "dist", "previewProtocol": "frozen-build-v2",
                "previewDiagnosticSchema": "aperture.agent-house-diagnostic-preview.v3"}
        config["lanes"][lane_id] = lane
        args = ["run", "--detach", "--name", container, "--cpus=2", "--memory=5g", "--pids-limit=128", "--workdir=/work",
                "--mount", f"type=bind,source={work},target=/work",
                "--env", "NODE_EXTRA_CA_CERTS=/run/proxy-ca.pem", "--env", "NODE_USE_ENV_PROXY=1",
                "--env", "PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1"]
        for mount in mounts:
            args.extend(["--mount", f"type=bind,source={mount['source']},target={mount['target']},readonly"])
        args.extend([IMAGE, "sleep", "infinity"])
        container_id, _ = docker(args, timeout=30)
        container_id = container_id.decode().strip()
        require(re.fullmatch(r"[a-f0-9]{64}", container_id), "Created author container identity is invalid")
        pnpm_version, _ = docker(["exec", container, "pnpm", "--version"], timeout=30)
        node_version, _ = docker(["exec", container, "node", "--version"], timeout=30)
        pnpm_version, node_version = pnpm_version.decode().strip(), node_version.decode().strip()
        require(pnpm_version == "10.12.1" and re.fullmatch(r"v24\.[0-9]+\.[0-9]+", node_version),
                "Author image package-manager or Node version differs")
        _, install_seconds = docker(["exec", container, "pnpm", "install", "--ignore-scripts", "--store-dir", "/opt/aperture-pnpm-store"],
                                    private_log=output["privateLogs"] / f"install-{engine}.log")
        require((work / "pnpm-lock.yaml").is_file(), "Dependency installation did not produce a lockfile")
        require(not (work / ".pnpm-store").exists(), "Dependency cache must remain outside the author source workspace")
        create_file(setup / "starters" / engine / "pnpm-lock.yaml", (work / "pnpm-lock.yaml").read_bytes())
        info_raw, _ = docker(["inspect", "--type", "container", container], timeout=30)
        info = json.loads(info_raw)[0]
        require(info["Id"] == container_id and info["Image"] == image_id, "Container image or identity changed")
        require(info["HostConfig"]["NanoCpus"] == 2_000_000_000 and info["HostConfig"]["Memory"] == 5 * 1024**3
                and info["HostConfig"]["PidsLimit"] == 128, "Created author resource limits differ")
        containers.append({"lane": lane_id, "id": container_id, "image": IMAGE, "imageId": image_id,
                           "nodeVersion": node_version, "pnpmVersion": pnpm_version,
                           "installElapsedSeconds": install_seconds, "cpuLimit": 2, "memoryLimitBytes": 5 * 1024**3,
                           "pidsLimit": 128, "dependencyStore": "/opt/aperture-pnpm-store"})
    # Recheck every copied repository byte after packing/installing. A concurrent
    # source/doc/dist change fails the preparation rather than mixing snapshots.
    for origin in origins:
        require(digest((ROOT / origin["source"]).read_bytes()) == origin["sha256"],
                f"Repository input changed during setup: {origin['source']}")
    require(repository_inputs() == input_hashes, "Repository input inventory changed during setup")
    spec = importlib.util.spec_from_file_location("prepare_round_author_lane", ROOT / "tools/agent-benchmark/author-lane.py")
    lane_module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(lane_module)
    # Temporary validation file is itself create-only retained input. No writes
    # to the active lanes.json occur anywhere in this script.
    if capacity_record is not None:
        admission_root = setup / "capacity-before-authors"
        Policy.load(capacity_record["path"], capacity_record["sha256"]).phase_admission(str(admission_root))
        receipt = record(admission_root / "admission.json")
        receipt["path"] = str(admission_root / "admission.json")
        config["capacityAdmission"] = receipt
    create_file(output["pending"], json_bytes(config), readonly=True)
    loaded = lane_module.load_config(output["pending"])
    for lane in loaded["lanes"].values():
        info_raw, _ = docker(["inspect", "--type", "container", lane["container"]], timeout=30)
        lane_module.validate_container(json.loads(info_raw)[0], lane)
    create_file(setup / "lanes.pending.json", json_bytes(config))
    order = ["three", "aperture", "aperture", "three", "three", "aperture"]
    if round_number % 2 == 0:
        order = ["aperture" if engine == "three" else "three" for engine in order]
    plan = {"schema": "aperture.house-race-preparation.v2", "preparedAt": utc_now(), "round": output["round"],
            "baseGitHead": base_head.decode().strip(), "status": "prepared-not-activated", "previewProtocol": "frozen-build-v2",
            "previewDiagnosticSchema": "aperture.agent-house-diagnostic-preview.v3",
            "previewCoordinator": "tools/agent-benchmark/preview-service-v3.py",
            "capacityPolicy": capacity_record,
            "capacityBeforePreparation": capacity_before,
            "authorModel": "Same root model inherited by both fork_turns:none authors; no model overrides",
            "authorBudgetSeconds": 1800, "previewAllowance": 3, "trialOrder": order, "artifactProtocol": protocol,
            "officialTrialRunner": "tools/agent-benchmark/run-v2.mjs",
            "timings": "Separate fresh-browser final-build trials, 60 warmup and 120 measured frames, three trials per engine, no dropped or substituted samples",
            "validationEvidence": record(setup / "validation-evidence" / validation.name, setup),
            "referenceEvidence": record(setup / "reference-evidence" / reference_evidence.name, setup),
            "containers": containers, "setupFiles": [record(path, setup) for path in sorted(setup.rglob("*")) if path.is_file()],
            "repositoryInputs": [{"path": path, **metadata} for path, metadata in sorted(input_hashes.items())],
            "nextSteps": "Root reviews and freezes these exact inputs, activates the pending configuration, starts the serial v3 diagnostic coordinator, then dispatches fresh independent authors. Preparation alone authorizes no scoring or superiority claim."}
    create_file(setup / "preparation.json", json_bytes(plan))
    readonly_tree(setup)
    print(json.dumps({"status": plan["status"], "round": output["round"], "pendingConfiguration": str(output["pending"]),
                      "review": str(setup / "preparation.json"), "sdkSnapshot": str(setup / "sdk-snapshot.json")}))


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--round", type=int, required=True)
    parser.add_argument("--prepare", action="store_true", help="Create fresh artifacts and install dependencies; default only describes paths")
    parser.add_argument("--validation-evidence", type=Path)
    parser.add_argument("--reference-evidence", type=Path)
    parser.add_argument("--capacity-policy", type=Path)
    parser.add_argument("--capacity-policy-sha256")
    parser.add_argument("--capacity-preparation-policy", type=Path)
    parser.add_argument("--capacity-preparation-policy-sha256")
    args = parser.parse_args(argv)
    require(3 <= args.round <= 999, "The binary geometry v2 recipe is for fresh rounds 003 through 999; historical preparations remain immutable")
    if not args.prepare:
        print(json.dumps({"mode": "plan-only", **{key: str(value) for key, value in paths(args.round).items()},
                          "requiredEvidence": ["latest root-reviewed full repository check", "latest root-reviewed reference producer output"],
                          "createsAuthors": False, "activatesConfiguration": False}, indent=2))
        return 0
    require(args.validation_evidence is not None and args.reference_evidence is not None,
            "--prepare requires --validation-evidence and --reference-evidence after root review")
    require(bool(args.capacity_policy) == bool(args.capacity_policy_sha256), "Both capacity policy path and SHA are required")
    require(bool(args.capacity_preparation_policy) == bool(args.capacity_preparation_policy_sha256), "Both preparation capacity policy path and SHA are required")
    require(bool(args.capacity_policy) == bool(args.capacity_preparation_policy), "Opt-in preparation requires both whole-round preparation and post-setup author policies")
    capacity_record = {"path": str(args.capacity_policy.resolve()), "sha256": args.capacity_policy_sha256} if args.capacity_policy else None
    preparation_record = {"path": str(args.capacity_preparation_policy.resolve()), "sha256": args.capacity_preparation_policy_sha256} if args.capacity_preparation_policy else None
    prepare(args.round, args.validation_evidence.resolve(), args.reference_evidence.resolve(), capacity_record, preparation_record)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (PreparationError, OSError, subprocess.TimeoutExpired, ValueError, KeyError) as error:
        # Subprocess environments/output never enter the public console.
        print(f"Round preparation failed: {error}", file=sys.stderr)
        raise SystemExit(1)
