# Preparing the version 2 fair author benchmark

The version 2 suite is `benchmarks/agent-house-race-v2-20261013`, with isolated
private controls under `.aperture-env/agent-house-race-v2`. The five historical
rounds and their method remain unchanged. Every independent author round uses a
different newly generated low-poly reference from the same house-road-car task
family. Both engines receive the exact same image and task brief within a round.
This suite compares independently authored implementations under an engine-neutral contract;
the separate controlled workload measures identical scene inputs.

`prepare-fair-round.py` reuses a freshly imported `prepare-round.py` instance for
SDK packing, source hashes, containers, limits and dependency installation. The
wrapper configures its paths, shared brief, declaration starter and source list,
and supplies a v2 preflight instead of the v1 fixed-reference preflight;
it does not edit the historical helper or its archived copies. Every prepared
round retains both helpers and all inherited control sources, plus the v2
fairness validator, exact contract and input-freeze receipt. The pinned author
image is `aperture-author-node:20261011`, image ID
`sha256:ef4ba913ffe42734dd39534672e5f959c167540e213a8c42dbd2a2a7233abd11`.
Both lanes require Node 24 and pnpm 10.12.1.

## Review and freeze before authors

The draft contains `method.json`, `fairness-contract.json` and
`reference-policy.json`. It freezes the fresh low-poly reference policy rather
than any one reference image. The unstarted fixed-reference proposal was
superseded before freeze or author dispatch and remains under
`superseded-fixed-reference-proposal` as historical context.
The method pins the contract's exact path, bytes and
SHA-256; after formatting or editing a draft contract, update that pin before
freezing. Its parsed contents must also exactly equal `FAIRNESS_V2` exported by
[fairness-v2.mjs](fairness-v2.mjs). Review the complete baseline, scene/resource
limits, retained 40/20/25/15 scoring weights and predeclared meaningful-edge
criterion before starting any author or native round.

The meaningful-edge criterion requires two successive fresh eligible pairs:
Aperture must lead by at least 0.25 combined points, show at least 10% better
runtime or active authoring time, reach visual and geometry means of at least 6,
and have visual and geometry means each at least the corresponding Three.js
mean. A runtime edge also requires the absolute difference between engine
medians to exceed the larger within-engine range of the three trial medians.
Report both trial ranges, overlap and judge disagreement; independent review is
still required. The separate author-time edge requires a 10% active-time gain.
These software SwiftShader measurements do not establish a physical-GPU advantage.

Freeze the reviewed method, contract, reference policy and common brief before any v2
round or author workspace exists:

```sh
python3 -B tools/agent-benchmark/prepare-fair-round.py --freeze-inputs
```

This create-only operation writes `input-freeze.json` and marks the three inputs
readonly. It starts no container or renderer. Any later hash, size, version or
shared-brief mismatch refuses preparation. Method changes require a new suite
version and fresh authors, and a second freeze cannot overwrite the receipt.

## Plan and prepare a fresh round

The first v2 pair uses round 006. Later attempts use new numbers, preserving all
successes, failures and partial preparations. Describe the planned paths and
commands without mutation:

```sh
python3 -B tools/agent-benchmark/prepare-fair-round.py --round 6
```

The coordinator supplies the public proxy CA at
`.aperture-env/agent-house-race-v2/public-ca/proxy-ca.pem`, reviewed full-check
evidence and reviewed reference-producer evidence. As with the existing recipe,
prepare consumes already built output; it does not build packages, produce the
reference, run checks, launch browsers or dispatch agents. After reviewing the
readiness evidence:

```sh
python3 -B tools/agent-benchmark/prepare-fair-round.py --round 6 --prepare \
  --validation-evidence /absolute/latest-check-summary.json \
  --reference-evidence /absolute/latest-producer-summary.json \
  --reference-image /absolute/new-image-gen-reference.png \
  --reference-generation-evidence /absolute/new-image-gen-generation.json
```

Every preparation requires an absolute original PNG from a new `image_gen` call
and a matching public JSON receipt with
`schema:"aperture.house-race-generated-reference.v2"`, `generator:"image_gen"`,
the exact `imageSha256`, nonempty `generatedAt` and exact generation `prompt`.
If it has `originalImagePath`, that returned PNG must also exactly match the
supplied image. The receipt is a coordinator attestation, not an independently
signed provider receipt. Preserve the actual original returned PNG and its
provenance.

Selection creates `references/round-006/reference.png`, a pinned
`reference-generation.json`, `task-brief.txt` and `reference-selection.json`.
The source PNG and every retained copy must have identical bytes, and image
hashes previously selected in this suite are refused, including failed rounds.
The setup copies the exact selection receipt, generation evidence, PNG and
brief into its own immutable evidence. The independent dispatch freeze uses that
round's authoritative `setup/reference.png` pin, not a fixed suite image hash.

An optional `--task-brief /absolute/task.txt` selects another shared brief before
author dispatch. Both prompts and readonly reference mounts receive those exact
bytes. The coordinator must review the image and brief for primitive/material
feasibility and absence of engine advice, prior results or scoreboard steering;
the selection receipt discloses that review requirement and retains any
generation feasibility review. Architecture, colors and layout may vary, while
the low-poly style, common cameras, lighting, background, optional-effect state,
scene/resource budgets, common author advice and scoring stay frozen across
pairs. Do not choose or regenerate a reference after seeing a pair's results.

To preselect a later reference before earlier round results, use
`--select-reference` with `--round`, `--reference-image`,
`--reference-generation-evidence` and optional `--task-brief`. This pins the
selection without preparing containers or dispatching authors. Later
`--prepare` consumes an already selected round only if the supplied PNG,
generation evidence and brief still exactly match its immutable pins.

All destinations are create-only. A failed preparation leaves partial artifacts
and containers for inspection; it never retries or overwrites them. The whole
preparation and post-setup author capacity policies remain optional paired
arguments, as in `prepare-round.py`. Actual available capacity must be reviewed
before launch. Preparation alone establishes no eligibility, score or lead.

## Explicit independent author and preview configuration

Review round 006 `setup/preparation.json`, exact source copies, SDK archive,
prompts, starters and `lanes.pending.json`. The private pending configuration is
`.aperture-env/agent-house-race-v2/control/lanes-r006.pending.json`; the wrapper
never replaces the old active `lanes.json`. The reviewed pending file can be
used directly after the coordinator closes prior lifecycles and author sessions.
Both fresh authors use `fork_turns: "none"`, the same inherited model and the
exact prompt. Each recorded operation includes the new configuration explicitly:

```sh
python3 -B tools/agent-benchmark/author-lane.py \
  --config /workspace/aperture/.aperture-env/agent-house-race-v2/control/lanes-r006.pending.json \
  three-r006 start
```

The other lane is `aperture-r006`. Run the serial diagnostic coordinator with
the same exact configuration:

```sh
python3 -B tools/agent-benchmark/preview-service-v3.py \
  --config /workspace/aperture/.aperture-env/agent-house-race-v2/control/lanes-r006.pending.json
```

Each new configuration freezes `scratchRoot:/workspace/shared/aperture-tmp`.
The preview service passes that root to the supported cleanup lifecycle wrapper;
the wrapper and native verifier still validate its marker and identity. An
omitted `scratchRoot` keeps the legacy preview behavior. Arbitrary roots are
refused. This does not authorize a browser launch outside the approved
`runVerifiedScene` route.

Both authors receive identical effects, lights, background, shadows, scene
scope and resource budgets, and the same indexing/instancing/batching/sharing/
static-shadow advice. No old result, author source or peer advice enters the
prompt or SDK. Each lane has the newly selected `/reference/reference.png`,
`/reference/task-brief.txt`, `/reference/fairness-contract.json` and
`/reference/fairness-declaration-template.json`, plus an intentionally incomplete
`/work/benchmark-fairness.json`. The author must complete the actual inventory
before final build and finish. Every vertex attribute, index, placement, texture
mip and material feature counts; a declaration alone proves nothing.

## Eligibility before scoring

After finish, independently audit the retained source, dependencies and build,
including the actual optional-effect state, lighting/shadow implementation,
complete inventories and required scene features. Capture official native
backend/canvas/geometry evidence with the established six serial fresh-browser
trials, exact source/build pins, 60 warmup and 120 measured frames and all three
cameras. Keep actual shadow PCF/depth-bias conventions visible in the audits.

Run the separate [fairness v2 gate](FAIRNESS_V2.md) with coordinator-verified exact
file pins for each declaration, independent source audit and native observation.
The pending configuration and preparation record disclose that required gate.
Use `fair-score-v2.mjs` to require all six fairness gates before delegating to the
existing strict verifier with its explicit v2 method schema. The old summarizer's
success is insufficient to establish v2 fairness. Only a
pair with complete valid fairness evidence can proceed to the retained blind
quality rubric and scoring. Preserve original evidence for every failed or
interrupted attempt, and never substitute previews for official trials.
