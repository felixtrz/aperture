#!/usr/bin/env python3
"""Prepare an isolated, predeclared v2 author benchmark without changing old evidence.

The existing prepare-round.py supplies packing, container limits, dependency
installation and source pinning. This entrypoint configures a fresh imported
instance; it never edits that helper or activates or dispatches author lanes.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import struct
import subprocess
import sys


ROOT = Path(__file__).resolve().parents[2]
SUITE = "agent-house-race-v2-20261013"
PRIVATE_NAME = "agent-house-race-v2"
METHOD_SCHEMA = "aperture.house-race-method.v2"
FREEZE_SCHEMA = "aperture.house-race-input-freeze.v2"
FAIRNESS_SCHEMA = "aperture.agent-house-fairness.v2"
DECLARATION_FILE = "benchmark-fairness.json"
SCRATCH_ROOT = "/workspace/shared/aperture-tmp"
EXPECTED_IMAGE_ID = "sha256:ef4ba913ffe42734dd39534672e5f959c167540e213a8c42dbd2a2a7233abd11"
REFERENCE_POLICY_V2 = {
    "kind": "fresh-low-poly-per-round", "taskFamily": "low-poly-house-road-car",
    "uniqueImagePerRound": True, "sharedWithinRound": True,
    "selection": "before-author-dispatch-and-results",
    "style": "simple matte low-poly forms feasible with ordinary Three.js primitives, indexed mesh geometry, opaque standard materials and declared common lights/effects",
    "generation": "new image_gen reference for each round; original returned PNG retained with provenance",
}
DEFAULT_TASK_BRIEF = "Build the supplied low-poly house, garden, curved road and blue car reference as a coherent three-dimensional scene. Match its architecture, simple matte colors, proportions, roof and car forms, and layout with ordinary opaque materials and geometric forms. Include the required house, roof, chimney, inset windows, porch, path, low garden boundary, plants, mailbox, curved road, curbs, broken white markings and blue car with four wheels. Use the frozen lighting, background, effects and site/resource limits; no distant landscape.\n"
EXTRA_INPUTS = (
    "tools/agent-benchmark/prepare-fair-round.py",
    "tools/agent-benchmark/FAIR_ROUND_PREPARATION.md",
    "tools/agent-benchmark/fairness-v2.mjs",
    "tools/agent-benchmark/fair-score-v2.mjs",
    "tools/agent-benchmark/FAIRNESS_V2.md",
    "tools/agent-benchmark/lifecycle-roots.mjs",
)


class FairPreparationError(Exception):
    pass


def require(condition, message):
    if not condition:
        raise FairPreparationError(message)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def json_bytes(value):
    return (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def suite_paths(root=ROOT):
    return {"evidence": root / "benchmarks" / SUITE,
            "private": root / ".aperture-env" / PRIVATE_NAME}


def pin(path, relative_to):
    require(path.is_file() and not path.is_symlink(), f"Required regular input is missing: {path}")
    data = path.read_bytes()
    return {"path": path.relative_to(relative_to).as_posix(), "bytes": len(data), "sha256": digest(data)}


def exported_contract(root=ROOT):
    script = "import { FAIRNESS_V2 } from './tools/agent-benchmark/fairness-v2.mjs'; process.stdout.write(JSON.stringify(FAIRNESS_V2));"
    result = subprocess.run(["node", "--input-type=module", "-e", script], cwd=root,
                            capture_output=True, timeout=30, check=False)
    require(result.returncode == 0, "Cannot load the versioned fairness contract; no subprocess output was disclosed")
    contract = json.loads(result.stdout)
    require(contract.get("schema") == FAIRNESS_SCHEMA, "Fairness export schema differs")
    return contract


def load_inputs(root=ROOT, *, require_frozen=True, contract=None):
    evidence = suite_paths(root)["evidence"]
    method_path = evidence / "method.json"
    contract_path = evidence / "fairness-contract.json"
    policy_path = evidence / "reference-policy.json"
    method_pin, contract_pin, policy_pin = [pin(path, evidence) for path in (method_path, contract_path, policy_path)]
    method = json.loads(method_path.read_bytes())
    frozen_contract = json.loads(contract_path.read_bytes())
    current_contract = exported_contract(root) if contract is None else contract
    require(frozen_contract == current_contract, "Frozen fairness contract differs from the current version; use a new benchmark version")
    require(method.get("schema") == METHOD_SCHEMA and method.get("benchmarkVersion") == "2.0.0"
            and method.get("mode") == "independent-authoring",
            "The new suite requires the predeclared v2 method")
    require(method.get("fairnessContract") == contract_pin, "Method fairness-contract path, hash or size differs")
    require("referenceSha256" not in method, "V2 freezes a fresh-reference policy, not one fixed reference image")
    policy = json.loads(policy_path.read_bytes())
    require(policy == REFERENCE_POLICY_V2 == method.get("referencePolicy"), "Predeclared fresh low-poly reference policy differs")
    require(method.get("authorBudgetSeconds") == 1800 and method.get("previewAllowance") == 3
            and method.get("trialsPerEngine") == 3, "Predeclared equal budget, preview allowance or trial count differs")
    require(method.get("engines", {}).get("three") == "0.186.1", "Pinned Three.js version differs")
    require(method.get("weights") == {"visual": 0.4, "geometry": 0.2, "runtime": 0.25, "authoringTime": 0.15},
            "Predeclared quality/runtime/authoring weights differ")
    require(method.get("meaningfulEdge") == {
        "successiveEligiblePairs": 2, "combinedMarginMinimum": 0.25,
        "componentGainMinimumFraction": 0.1, "componentGain": ["runtime", "activeAuthoringTime"],
        "visualMeanMinimum": 6, "geometryMeanMinimum": 6, "noMaterialQualityRegression": True,
        "reportRuntimeTrialSpread": True,
    }, "Predeclared meaningful-edge criteria differ")
    require(method.get("runtimeEdge") == {
        "minimumFraction": 0.1,
        "minimumAbsoluteDifference": "greater than the larger within-engine max-minus-min range of the three trial medians",
        "reportRangeOverlap": True, "independentReview": True,
    }, "Predeclared runtime-spread criteria differ")
    require(frozen_contract.get("version") == method.get("benchmarkVersion")
            and frozen_contract.get("mode") == "independent-authoring", "Method and fairness versions/modes differ")
    require(frozen_contract.get("measurement", {}).get("trialsPerEngine") == 3
            and frozen_contract["measurement"].get("warmupFrames") == 60
            and frozen_contract["measurement"].get("measuredFrames") == 120,
            "Common fixed-frame measurement contract differs")
    result = {"method": method, "contract": frozen_contract,
              "pins": {"method": method_pin, "contract": contract_pin, "referencePolicy": policy_pin}}
    if require_frozen:
        receipt_path = evidence / "input-freeze.json"
        pin(receipt_path, evidence)
        receipt = json.loads(receipt_path.read_bytes())
        require(receipt.get("schema") == FREEZE_SCHEMA and receipt.get("benchmarkVersion") == "2.0.0",
                "Exact pre-author v2 freeze receipt required")
        require(receipt.get("inputs") == result["pins"], "Frozen input hash/size pins differ; preparation refused")
        require(receipt.get("commonPromptSha256") == digest(common_prompt(frozen_contract, contract_pin["sha256"]).encode()),
                "Shared author brief changed after the freeze")
        result["freeze"] = receipt
        result["freezePin"] = pin(receipt_path, evidence)
    return result


def freeze_inputs(root=ROOT, *, contract=None):
    """Create the freeze receipt only after a coordinator has reviewed the draft inputs."""
    paths = suite_paths(root)
    evidence = paths["evidence"]
    receipt_path = evidence / "input-freeze.json"
    require(not receipt_path.exists(), "Create-only freeze receipt already exists")
    require(not any(evidence.glob("round-*")), "Freeze must precede all v2 author-round evidence")
    require(not paths["private"].joinpath("lanes").exists(), "Freeze must precede all v2 author workspaces")
    inputs = load_inputs(root, require_frozen=False, contract=contract)
    base = load_base(root)
    receipt = {"schema": FREEZE_SCHEMA, "benchmarkVersion": "2.0.0", "frozenAt": base.utc_now(),
               "inputs": inputs["pins"],
               "commonPromptSha256": digest(common_prompt(inputs["contract"], inputs["pins"]["contract"]["sha256"]).encode()),
               "policy": "Freeze method, fairness contract, shared brief and fresh low-poly reference policy before author start and results; retain these controls for every pair. Method/contract/policy changes require a new version and fresh authors.",
               "claimLimits": "An input freeze predeclares the method; it establishes no rendered evidence, score or engine lead."}
    base.create_file(receipt_path, json_bytes(receipt), readonly=True)
    for name in ("method.json", "fairness-contract.json", "reference-policy.json"):
        (evidence / name).chmod(0o444)
    return receipt


def load_base(root=ROOT):
    spec = importlib.util.spec_from_file_location("isolated_fair_round_helper", root / "tools/agent-benchmark/prepare-round.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def common_prompt(contract, contract_sha256):
    base = load_base()
    original = base.COMMON_PROMPT.split("\n\n", 1)
    scene_brief = "Build a coherent, moderately detailed low-poly three-dimensional scene from the newly generated reference supplied for this round. Match the simple geometric architecture, matte colors, proportions and layout using ordinary indexed meshes and opaque standard materials. Include the required house, garden, road and blue car features described in the selected task brief. Geometry should remain convincing from other views. Indexing, shared geometry, instancing and batching are allowed. Do not use the reference image as a texture, background or billboard, or bake the scene into a picture. No ready-made house/car scene or image-generation tool. You may use public assigned-engine docs and inspect its installed source. Do not add a distant landscape."
    common = scene_brief + "\n\n" + original[1]
    fairness = f"""
This is the version 2 independent-authoring benchmark. Each round uses a different newly generated low-poly reference; both assigned engines receive the same image and task brief within this round. The task family, simple matte style, camera/render baseline, effects and resource/scoring rules stay fixed across rounds; architecture, colors and layout may vary. The reference is selected and pinned before authors or results. The identical rules below take precedence over generic visual defaults. Implement the complete frozen baseline, including disabling any assigned-engine automatic environment, bloom, SSAO and other optional effects. Use one directional sun and one constant ambient fill only; the supplied background is a solid color. The site bounds and object/resource budgets are eligibility limits, not targets to fill.

Frozen contract SHA-256: {contract_sha256}
Read /reference/fairness-contract.json for these exact values:
{json.dumps(contract, ensure_ascii=False, indent=2)}

Both authors receive the same optimization guidance: indexing, shared geometry, instancing, batching and static-shadow reuse are allowed. Choose compact indexed meshes where appropriate, reuse repeated geometry, and batch or instance repeated objects when your assigned public API supports it. Do not add geometry merely to exhaust a budget. Keep the complete exported scene consistent with the actual submitted native draws. No previous benchmark results or peer implementation are provided.

Complete /work/{DECLARATION_FILE} before the final build and finish. The starter is deliberately incomplete and cannot establish eligibility. Its schema is aperture.agent-house-fairness-declaration.v2, engine is your assigned engine, contractSha256 is the exact frozen hash above and authorId is your assigned lane ID. Copy the exact settings object unchanged as the declaration of settings you actually implemented. Mark every requiredFeatures entry true only after implementing it. scene records house/car counts, extra buildings/vehicles, site min/max X/Z, distantLandscape:false, and actual trees/shrubs/extraDecorativeObjects counts.

inventory must describe every actual rendered source resource. geometries have unique id, actual vertexCount, placements (all ordinary copies and instances), attributes (semantic, components, componentBytes for every stored vertex attribute), indices (count, componentBytes; explicit null for nonindexed), and instanceAttributes (semantic/components/componentBytes; empty for ordinary transforms). Count a stored shared geometry once, with all its placements. Triangle lists are required. textures have unique id, width, height, layers, bytesPerTexel:4 and complete mipLevels. materials have unique id, model:'metallic-roughness', alphaMode:'opaque' or 'mask', extensions:[], emissiveIntensity from 0 to 1, and maps mapping the allowed baseColor/normal/metallicRoughness/emissive semantic to a declared texture ID. lights have unique id and kind:'directional' or 'ambient'. Include every authored texture; disclose procedural texture resolution and mip chain. Budgets count every vertex attribute and index by its actual component width, plus placement-weighted triangles; lossless export widening does not redefine source storage cost.

Your declaration is a claim, independently checked against retained final source/dependencies/build and native geometry/canvas/backend evidence. Report how your public renderer implements the PCF shadow filter and its signed depth-bias convention in your final note; matched public parameters do not promise identical shadow pixels. Optional effects, omitted resources, excess budgets, unmatched baseline settings, capture gaps or undocumented source settings invalidate the comparison. Scoring and eligibility are determined after both independent builds finish. You may not inspect or edit coordinator scoring or evidence.
"""
    # Keep the transport, recorded operational workflow and equal author limits.
    # Put the exact baseline before the original transport/isolation instructions.
    paragraphs = common.split("\n\n", 1)
    return paragraphs[0] + "\n\n" + fairness + "\n\n" + paragraphs[1]


def round_reference_directory(round_number, root=ROOT):
    return suite_paths(root)["evidence"] / "references" / f"round-{round_number:03d}"


def reference_history(root=ROOT):
    evidence = suite_paths(root)["evidence"]
    return sorted([*evidence.glob("references/round-*/reference-selection.json"),
                   *evidence.glob("round-*/setup/reference-selection.json")])


def verify_reference_uniqueness(image_sha256, round_number, root=ROOT):
    round_id = f"round-{round_number:03d}"
    for path in reference_history(root):
        require(path.is_file() and not path.is_symlink(), "Previous reference selection is not a regular file")
        previous = json.loads(path.read_bytes())
        require(previous.get("schema") == "aperture.house-race-reference-selection.v2"
                and re.fullmatch(r"[a-f0-9]{64}", previous.get("reference", {}).get("sha256", "")) is not None,
                "Previous reference selection is malformed; reconcile it before another round")
        if previous.get("round") != round_id:
            require(previous.get("reference", {}).get("sha256") != image_sha256,
                    "Each author round requires a different newly generated reference; image hash was already selected")


def select_reference(round_number, image_path, generation_evidence, task_brief=None, root=ROOT):
    """Pin a root-reviewed new generated PNG and shared brief, before author setup."""
    require(6 <= round_number <= 999, "The isolated v2 suite starts at round 006")
    load_inputs(root)
    require(image_path.is_absolute() and image_path.resolve() == image_path,
            "Reference image must be an absolute canonical PNG path")
    require(generation_evidence.is_absolute() and generation_evidence.resolve() == generation_evidence,
            "Reference generation evidence must be an absolute canonical file path")
    for path in (image_path, generation_evidence):
        require(path.is_file() and not path.is_symlink(), "Reference and generation evidence must be regular files")
    image = image_path.read_bytes()
    require(len(image) <= 32 * 1024 * 1024 and len(image) >= 33 and image[:8] == b"\x89PNG\r\n\x1a\n"
            and image[8:16] == b"\x00\x00\x00\rIHDR", "Reference must be a bounded original PNG")
    width, height = struct.unpack(">II", image[16:24])
    require(0 < width <= 8192 and 0 < height <= 8192, "Reference PNG dimensions exceed the bounded image policy")
    image_sha = digest(image)
    generation = json.loads(generation_evidence.read_bytes())
    require(generation.get("schema") == "aperture.house-race-generated-reference.v2"
            and generation.get("imageSha256") == image_sha and generation.get("generator") == "image_gen"
            and isinstance(generation.get("prompt"), str) and generation["prompt"].strip()
            and isinstance(generation.get("generatedAt"), str) and generation["generatedAt"].strip(),
            "Exact image_gen generation receipt and PNG hash are required")
    original_path = Path(generation.get("originalImagePath", str(image_path)))
    require(original_path.is_absolute() and original_path.resolve() == original_path and original_path.is_file()
            and not original_path.is_symlink() and original_path.read_bytes() == image,
            "Actual image_gen returned PNG differs from the supplied selected image")
    verify_reference_uniqueness(image_sha, round_number, root)
    destination = round_reference_directory(round_number, root)
    require(not destination.exists(), "Create-only reference selection already exists")
    brief = DEFAULT_TASK_BRIEF.encode()
    if task_brief is not None:
        require(task_brief.is_absolute() and task_brief.resolve() == task_brief and task_brief.is_file()
                and not task_brief.is_symlink(), "Task brief must be an absolute canonical regular file")
        brief = task_brief.read_bytes()
        require(0 < len(brief) <= 64 * 1024, "Shared task brief must be nonempty and bounded")
        brief.decode("utf-8")
    base = load_base(root)
    destination.mkdir(parents=True)
    for name, data in (("reference.png", image), ("reference-generation.json", generation_evidence.read_bytes()),
                       ("task-brief.txt", brief)):
        base.create_file(destination / name, data, readonly=True)
    selection = {"schema": "aperture.house-race-reference-selection.v2", "round": f"round-{round_number:03d}",
                 "selectedAt": base.utc_now(), "referencePolicy": REFERENCE_POLICY_V2,
                 "reference": pin(destination / "reference.png", destination),
                 "generationEvidence": pin(destination / "reference-generation.json", destination),
                 "taskBrief": pin(destination / "task-brief.txt", destination),
                 "referenceImageInput": {"path": str(image_path), "bytes": len(image), "sha256": image_sha},
                 "originalReturnedPng": {"path": str(original_path), "bytes": len(image), "sha256": image_sha},
                 "originalTaskBrief": None if task_brief is None else {"path": str(task_brief), "bytes": len(brief), "sha256": digest(brief)},
                 "dimensions": {"width": width, "height": height},
                 "reviewRequirement": "Coordinator reviews primitive/material feasibility and absence of engine advice or previous results in the image and shared brief before author dispatch.",
                 "retainedFeasibilityReview": generation.get("feasibilityReview"),
                 "provenanceLimits": "The retained generation receipt is a coordinator attestation to the image_gen operation, not independently authenticated generator provenance."}
    base.create_file(destination / "reference-selection.json", json_bytes(selection), readonly=True)
    require(image_path.read_bytes() == image and original_path.read_bytes() == image
            and generation_evidence.read_bytes() == (destination / "reference-generation.json").read_bytes(),
            "Original returned image or generation receipt changed during selection")
    return selection


def load_reference(round_number, root=ROOT):
    directory = round_reference_directory(round_number, root)
    selection_path = directory / "reference-selection.json"
    pin(selection_path, directory)
    selection = json.loads(selection_path.read_bytes())
    require(selection.get("schema") == "aperture.house-race-reference-selection.v2"
            and selection.get("round") == f"round-{round_number:03d}"
            and selection.get("referencePolicy") == REFERENCE_POLICY_V2, "Exact v2 per-round reference selection required")
    for key, name in (("reference", "reference.png"), ("generationEvidence", "reference-generation.json"), ("taskBrief", "task-brief.txt")):
        require(selection.get(key) == pin(directory / name, directory), "Selected reference, generation evidence or task brief changed")
    for key in ("originalReturnedPng", "referenceImageInput"):
        original = selection.get(key, {})
        source = Path(original.get("path", ""))
        require(source.is_absolute() and source.resolve() == source and source.is_file() and not source.is_symlink()
                and source.stat().st_size == original.get("bytes") and digest(source.read_bytes()) == original.get("sha256")
                == selection["reference"]["sha256"], "Actual original returned PNG differs from the retained selected copy")
    original_brief = selection.get("originalTaskBrief")
    if original_brief is not None:
        source = Path(original_brief.get("path", ""))
        require(source.is_absolute() and source.is_file() and not source.is_symlink()
                and source.stat().st_size == original_brief.get("bytes")
                and digest(source.read_bytes()) == original_brief.get("sha256") == selection["taskBrief"]["sha256"],
                "Actual original task brief differs from the retained selected copy")
    verify_reference_uniqueness(selection["reference"]["sha256"], round_number, root)
    return selection


def reference_for_preparation(round_number, image_path, generation_evidence, task_brief=None, root=ROOT):
    """Consume an exact preselected round, or create its first immutable selection."""
    selection_path = round_reference_directory(round_number, root) / "reference-selection.json"
    if not selection_path.exists():
        return select_reference(round_number, image_path, generation_evidence, task_brief, root)
    selection = load_reference(round_number, root)
    for path in (image_path, generation_evidence):
        require(path.is_absolute() and path.resolve() == path and path.is_file() and not path.is_symlink(),
                "Preselected reference inputs must remain absolute canonical regular files")
    require(digest(image_path.read_bytes()) == selection["reference"]["sha256"]
            and image_path.stat().st_size == selection["reference"]["bytes"],
            "Preparation image differs from the already selected reference")
    require(digest(generation_evidence.read_bytes()) == selection["generationEvidence"]["sha256"]
            and generation_evidence.stat().st_size == selection["generationEvidence"]["bytes"],
            "Preparation generation receipt differs from the already selected reference")
    brief = DEFAULT_TASK_BRIEF.encode() if task_brief is None else task_brief.read_bytes()
    require(len(brief) == selection["taskBrief"]["bytes"] and digest(brief) == selection["taskBrief"]["sha256"],
            "Preparation task brief differs from the already selected shared brief")
    return selection


def declaration_template(engine, author_id, contract, contract_sha256):
    return {"schema": "aperture.agent-house-fairness-declaration.v2", "engine": engine,
            "contractSha256": contract_sha256, "authorId": author_id,
            "settings": contract["settings"],
            "requiredFeatures": {name: False for name in contract["scene"]["requiredFeatures"]},
            "scene": {**{key: value for key, value in contract["scene"].items() if key != "requiredFeatures"},
                      "trees": None, "shrubs": None, "extraDecorativeObjects": None},
            "inventory": {"geometries": [], "textures": [], "materials": [], "lights": []}}


def configured_helper(round_number, root=ROOT, *, inputs=None):
    """Configure a separate module instance; historical helper globals are untouched."""
    require(6 <= round_number <= 999, "The isolated v2 suite starts at round 006; earlier evidence remains immutable")
    inputs = load_inputs(root) if inputs is None else inputs
    base = load_base(root)
    load_reference(round_number, root)
    reference_directory = round_reference_directory(round_number, root)
    locations = suite_paths(root)
    base.ROOT, base.PRIVATE, base.EVIDENCE = root, locations["private"], locations["evidence"]
    base.REFERENCE = reference_directory / "reference.png"
    base.SETUP_INPUTS = (*base.SETUP_INPUTS, *EXTRA_INPUTS)
    contract, contract_sha = inputs["contract"], inputs["pins"]["contract"]["sha256"]
    base.COMMON_PROMPT = common_prompt(contract, contract_sha) + "\n\nSelected shared task brief for this round:\n" + (reference_directory / "task-brief.txt").read_text()
    original_prompt, original_starter = base.prompt, base.starter
    original_copy, original_create, original_inputs, original_docker = base.copy_file, base.create_file, base.repository_inputs, base.docker
    pending = base.paths(round_number)["pending"]

    def checked_preflight(number, validation, reference_evidence):
        require(number == round_number, "Configured round number differs")
        load_inputs(root)
        load_reference(number, root)
        output = base.paths(number)
        for key in ("sdk", "lanes", "public", "pending", "privateLogs"):
            require(not output[key].exists(), f"Create-only destination already exists: {output[key]}")
        for receipt in (validation, reference_evidence):
            require(receipt.is_file() and not receipt.is_symlink(), "Root-reviewed validation/reference producer evidence is required")
        ca = base.PRIVATE / "public-ca/proxy-ca.pem"
        require(ca.is_file() and not ca.is_symlink(), "Public proxy CA is missing")
        for name in base.PUBLISHABLE:
            package = root / "packages" / name
            manifest = json.loads((package / "package.json").read_bytes())
            require(manifest.get("name") == "@aperture-engine/" + name and manifest.get("private") is not True,
                    "Publishable package identity differs")
            require((package / "dist").is_dir(), f"Build output is missing for {name}; setup never builds it")
        for doc in base.DOCS:
            require((root / "docs" / doc).is_file(), f"Public documentation is missing: {doc}")
        for name in base.GUIDE_EXAMPLES:
            source = root / "examples" / name
            require(source.is_file() and not source.is_symlink(), f"Public guide example is missing or linked: {name}")
        for relative in base.SETUP_INPUTS:
            require((root / relative).is_file(), f"Setup input is missing: {relative}")
        return output

    def fair_prompt(engine, lane_id, public, interface):
        original_create(public / "fairness-contract.json", (base.EVIDENCE / "fairness-contract.json").read_bytes())
        original_create(public / "task-brief.txt", (reference_directory / "task-brief.txt").read_bytes())
        original_create(public / "fairness-declaration-template.json", json_bytes(declaration_template(engine, lane_id, contract, contract_sha)))
        result = original_prompt(engine, lane_id, public, interface)
        old = f"python3 -B {root}/tools/agent-benchmark/author-lane.py {lane_id} ACTION [TEXT]"
        new = f"python3 -B {root}/tools/agent-benchmark/author-lane.py --config {pending} {lane_id} ACTION [TEXT]"
        require(old in result, "Inherited author operations changed; explicit v2 configuration could not be bound")
        return result.replace(old, new)

    def fair_starter(engine, dependencies):
        return {**original_starter(engine, dependencies), DECLARATION_FILE:
                json_bytes(declaration_template(engine, f"{engine}-r{round_number:03d}", contract, contract_sha))}

    def fair_copy(source, destination, origins):
        original_copy(source, destination, origins)
        if source == base.EVIDENCE / "method.json" and destination.name == "method.json":
            for name in ("fairness-contract.json", "input-freeze.json", "reference-policy.json"):
                original_copy(base.EVIDENCE / name, destination.with_name(name), origins)
            for name in ("reference-selection.json", "reference-generation.json", "task-brief.txt"):
                original_copy(reference_directory / name, destination.with_name(name), origins)

    def fair_create(path, data, readonly=False):
        if path.name in (pending.name, "lanes.pending.json", "preparation.json"):
            value = json.loads(data)
            if value.get("schema") in ("aperture.author-lanes.v1", "aperture.house-race-preparation.v2"):
                setup = base.paths(round_number)["public"] / "setup"
                value.update({"benchmarkVersion": "2.0.0", "benchmarkSuite": SUITE,
                              "fairnessContract": {**inputs["pins"]["contract"], "path": str(setup / "fairness-contract.json")},
                              "methodPin": {**inputs["pins"]["method"], "path": str(setup / "method.json")},
                              "inputFreeze": {**inputs["freezePin"], "path": str(setup / "input-freeze.json")},
                              "referenceSelection": {**pin(reference_directory / "reference-selection.json", reference_directory), "path": str(setup / "reference-selection.json")},
                              "scratchRoot": SCRATCH_ROOT,
                              "authorDeclarationFile": DECLARATION_FILE,
                              "fairnessGate": "Independent declarations, full source audits and native observations must pass fairness-v2 before any v2 score; legacy summary alone is insufficient."})
                data = json_bytes(value)
        original_create(path, data, readonly=readonly)

    def fair_repository_inputs():
        result = original_inputs()
        for name in ("fairness-contract.json", "input-freeze.json", "reference-policy.json"):
            path = base.EVIDENCE / name
            info = pin(path, root)
            result[info["path"]] = {"bytes": info["bytes"], "sha256": info["sha256"]}
        for name in ("reference-selection.json", "reference-generation.json", "task-brief.txt"):
            info = pin(reference_directory / name, root)
            result[info["path"]] = {"bytes": info["bytes"], "sha256": info["sha256"]}
        return result

    def pinned_docker(args, **kwargs):
        raw, elapsed = original_docker(args, **kwargs)
        if args[:2] == ["image", "inspect"]:
            require(raw.decode().strip() == EXPECTED_IMAGE_ID, "Author image differs from the root-reviewed pinned image")
        return raw, elapsed

    base.preflight, base.prompt, base.starter = checked_preflight, fair_prompt, fair_starter
    base.copy_file, base.create_file, base.repository_inputs, base.docker = fair_copy, fair_create, fair_repository_inputs, pinned_docker
    return base


def plan(round_number, root=ROOT):
    require(6 <= round_number <= 999, "The isolated v2 suite starts at round 006")
    base = load_base(root)
    locations = suite_paths(root)
    base.PRIVATE, base.EVIDENCE = locations["private"], locations["evidence"]
    output = base.paths(round_number)
    return {"mode": "plan-only", "benchmarkVersion": "2.0.0", "benchmarkSuite": SUITE,
            **{key: str(value) for key, value in output.items()},
            "freezeReceipt": str(locations["evidence"] / "input-freeze.json"),
            "roundReferenceDirectory": str(round_reference_directory(round_number, root)),
            "referencePolicy": REFERENCE_POLICY_V2,
            "publicCa": str(locations["private"] / "public-ca/proxy-ca.pem"),
            "scratchRoot": SCRATCH_ROOT,
            "authorCommand": f"python3 -B {root}/tools/agent-benchmark/author-lane.py --config {output['pending']} LANE ACTION [TEXT]",
            "previewCommand": f"python3 -B {root}/tools/agent-benchmark/preview-service-v3.py --config {output['pending']}",
            "requiredEvidence": ["pre-author frozen v2 method, fairness contract and fresh low-poly reference policy",
                                 "new image_gen PNG and matching generation receipt selected before authors",
                                 "latest root-reviewed full repository check", "latest root-reviewed reference producer output"],
            "createsAuthors": False, "activatesConfiguration": False}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--round", type=int, default=6)
    modes = parser.add_mutually_exclusive_group()
    modes.add_argument("--freeze-inputs", action="store_true", help="Create-only freeze of the coordinator-reviewed draft method/reference policy/contract; no containers")
    modes.add_argument("--select-reference", action="store_true", help="Create-only pin of a new low-poly image and shared brief before authors; no containers")
    modes.add_argument("--prepare", action="store_true", help="Prepare fresh v2 lanes after input freeze and readiness review")
    parser.add_argument("--validation-evidence", type=Path)
    parser.add_argument("--reference-evidence", type=Path)
    parser.add_argument("--reference-image", type=Path, help="Absolute original PNG returned by image_gen for this fresh round")
    parser.add_argument("--reference-generation-evidence", type=Path, help="Absolute matching public image_gen generation receipt")
    parser.add_argument("--task-brief", type=Path, help="Optional absolute shared low-poly task brief, reviewed before authors")
    parser.add_argument("--capacity-policy", type=Path)
    parser.add_argument("--capacity-policy-sha256")
    parser.add_argument("--capacity-preparation-policy", type=Path)
    parser.add_argument("--capacity-preparation-policy-sha256")
    args = parser.parse_args(argv)
    if args.freeze_inputs:
        receipt = freeze_inputs()
        print(json.dumps({"status": "inputs-frozen-before-authors", "receipt": str(suite_paths()["evidence"] / "input-freeze.json"), "inputs": receipt["inputs"]}))
        return 0
    if args.select_reference:
        require(args.reference_image is not None and args.reference_generation_evidence is not None,
                "Reference selection requires --reference-image and --reference-generation-evidence")
        selection = select_reference(args.round, args.reference_image, args.reference_generation_evidence, args.task_brief)
        print(json.dumps({"status": "reference-selected-before-authors", "round": selection["round"],
                          "selection": str(round_reference_directory(args.round) / "reference-selection.json"),
                          "reference": selection["reference"], "taskBrief": selection["taskBrief"],
                          "createsAuthors": False, "activatesConfiguration": False}))
        return 0
    if not args.prepare:
        print(json.dumps(plan(args.round), indent=2))
        return 0
    require(args.validation_evidence is not None and args.reference_evidence is not None,
            "Preparation requires separately reviewed validation and reference-producer evidence")
    require(args.reference_image is not None and args.reference_generation_evidence is not None,
            "Preparation requires a different newly generated --reference-image and --reference-generation-evidence for every round")
    require(bool(args.capacity_policy) == bool(args.capacity_policy_sha256), "Both author capacity policy path and SHA are required")
    require(bool(args.capacity_preparation_policy) == bool(args.capacity_preparation_policy_sha256), "Both preparation capacity policy path and SHA are required")
    require(bool(args.capacity_policy) == bool(args.capacity_preparation_policy), "Both preparation and author capacity policies are required together")
    reference_for_preparation(args.round, args.reference_image, args.reference_generation_evidence, args.task_brief)
    base = configured_helper(args.round)
    capacity_record = {"path": str(args.capacity_policy.resolve()), "sha256": args.capacity_policy_sha256} if args.capacity_policy else None
    preparation_record = {"path": str(args.capacity_preparation_policy.resolve()), "sha256": args.capacity_preparation_policy_sha256} if args.capacity_preparation_policy else None
    try:
        base.prepare(args.round, args.validation_evidence.resolve(), args.reference_evidence.resolve(), capacity_record, preparation_record)
        load_reference(args.round)
    except base.PreparationError as error:
        raise FairPreparationError(str(error)) from error
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (FairPreparationError, OSError, subprocess.TimeoutExpired, ValueError, KeyError) as error:
        print(f"Fair round preparation failed: {error}", file=sys.stderr)
        raise SystemExit(1)
