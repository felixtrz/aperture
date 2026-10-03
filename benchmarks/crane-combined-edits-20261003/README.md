# Paired combined crane edits: frozen post-author regression

This is a **post-author derived integration regression**, not a new independent
creation exercise, a revision of the old author attempts, an engine ranking, or
performance evidence. Native WebGPU execution is pending separate admission.
The original failed and passing author/post-author artifacts remain unchanged.
Exact equal author model/settings and complete authentic author transcripts are
still unavailable. No transcript is reconstructed and no formal score is valid.

## One increased axis

Compose parameter values that each implementation previously tested individually.
Keep both independently authored constructors, geometry expressions, appearance,
assets and rendering choices. `derive.py` is a strict, exact-once mechanical
adapter derivation. `derivation.json` pins every original and derived file;
`derivation.diff` shows every changed line. The sole constructor seam is replacing
the old named-catalog lookup with the common frozen `parametersFor(edit)` resolver.
No catalog is mutated. The full baseline and all seven single-edit scene outputs
(including geometry, topology, material assignments, palette and camera settings)
are compared exactly against the unchanged originals in the CPU suite.

Existing starting points:

- Aperture: `../crane-live-edits-20261003/author-a/post-author-byte-diagnostic/`.
  Generated-app Worker/ECS publication, native consumed-frame proof, and preserved
  raw-byte/upload observers remain intact.
- Three.js: `../crane-live-edits-20261003/author-b/v1/`. Persistent native Mesh/
  BufferGeometry updates and actual GPUBuffer readback adapters remain intact.
- Shared recorder/capture: the old live harness, now independently enforcing the
  combined contract, no-op resource checks and fully opaque PNGs. The PNG decoder
  can expose actual decoded RGB bytes for offline exact comparisons.

Adapter differences beyond the constructor seam are explicit: fresh-session
initialization, dynamic session selection, transport evidence, completion count,
post-author HTML labels, strict no-op/semantics/raw-byte gates and recording.
Three.js's old 60-second worker-response deadline becomes 180 seconds, matching
Aperture's existing 180-second state deadline. This changes patience only, not
render settings. Both receive identical 900-second live and 240-second fresh
session caps. These are generous failure deadlines, not measured latency budgets.

## Frozen sequence and physical meanings

Each engine receives one live session with 14 captures:

1. Baseline; baseline no-op
2. Articulation (shoulder 65°, relative elbow −60°, hoist 1.9); its no-op
3. All seven prior edits; its no-op
4. Shape plus assembly, restoring articulation to baseline; its no-op
5. Full reset; reset no-op
6. All seven edits again; its no-op
7. Full reset again; reset no-op

Four separately cold sessions directly initialize baseline, articulation, all,
and shape-plus-assembly. They do not render an initial baseline and then edit it.
Aperture's fresh controls start their ECS assets at the selected composition and
must report zero asset replacements at first capture. Three.js likewise installs
the selected worker geometry before its renderer resources are built.

Total: **5 sessions / 18 states per engine; 10 sessions / 36 states paired**.
Identical state order, parameters, state/session deadlines, capture resolution,
one-at-a-time commands and admitted attempt budget apply to both. The proposed
first admission is one immutable `attempt-001` for each selected session. Stop
on the first real mismatch; do not automatically retry a failed native attempt.
A changed adapter requires another identified freeze and fresh admission.

Exact parameter values are exported in `contract.mjs` and copied to
`frozen-contract.json`. Shoulder/elbow are degrees; lengths are world units.
Positive assembly yaw rotates +X toward −Z around [−2.15, 0, 0.15], followed by
world dx/dz. Crane and platform move together; wall, pipe and yard do not.
Tier changes lift the crane by height−0.18 before assembly. The hoist stays
world-vertical. `semantics.mjs` checks native-position-derived world endpoints,
load/platform centers, elbow/cable continuity, 13 pipe centerlines and arch edges
against independent physical expectations, at the inherited 2e−5 geometry
precision. Raw bytes and image controls have **no tolerance**.

## Mechanisms and counters are deliberately different

Aperture preserves real ECS entities and mesh handles but replaces MeshAsset and
published typed-array objects when geometry changes. The tested live CPU sequence
performs 240 successful asset publications replacing existing MeshAsset objects.
This count includes resets, excludes initial assets, and never counts no-ops.
Three.js preserves Mesh, BufferGeometry and BufferAttribute object references;
its live CPU sequence performs 263 changed-attribute `.set` operations and 132
matrix updates, with zero geometry/attribute replacements. A matrix update is an
actual matrix assignment, not a changed vertex count. In all fresh controls these
mutation counters start at zero. These are explicitly observed CPU operations,
not GPU memory, residency, throughput, draw-cost, allocation parity, or scores.
Later native records separately retain genuine resource and upload/readback counts.

## Required native acceptance

- Approved `runVerifiedScene` only, under the adopted `runtime_pressure.py`
  lifecycle. Actual native SwiftShader WebGPU, exact approved launch flags, one
  Worker/device/canvas/scene per session; no WebGL, GPU errors or device loss.
- Aperture must use shared-array-buffer without fallback, retain the original
  deterministic stepping/full-summary cadence, and join requested state/revision,
  worker publication, received/consumed snapshot and actual completed swapchain
  frame exactly. A command echo or queue counter alone is insufficient.
- Three.js must observe the exact worker revision at genuine native before/after
  render and mesh-draw callbacks, then retain actual buffer readback bytes.
- Both retain original raw evidence adapters. Aperture captures native Uint8 view
  bytes before JSON conversion and compares actual bound upload bytes. Three.js
  compares actual GPU readback with CPU attributes and preserved worker-source
  bytes. Never reconstruct evidence bytes from numeric JSON floats. Signed-zero
  corruption fails. Aperture upload evidence is not a GPU readback claim.
- Stable runtime/entity/mesh identities; unchanged within-engine camera and
  appearance. Every no-op must still submit/capture a real frame but change no
  geometry bytes, assets or observed CPU mutation counters. Every edit/reset must
  change actual geometry. Full resets and repeated edits must recover exactly.
- Every capture is the genuine 1024×1024 canvas after its queue fence and two
  presentation opportunities, opaque and nonblank. JSON/PNG artifacts and receipts
  are immutable, sequential, SHA-256 acknowledged; failed and partial artifacts
  are retained. All actual served inputs are pinned and recorded, before/after
  source manifests must match, and server/browser/descendant cleanup must finish.
- `compare.mjs` requires 28 exact decoded-RGB **and raw-geometry** live/fresh
  equalities, six visible combined mutations, and two exact retained-baseline
  pixel equalities. Within-engine comparisons only; cross-engine appearance is
  intentionally not equalized. The baseline controls are Aperture post-author
  attempt 005 and Three.js original attempt 001, pinned here.

`run.mjs` validates each state in browser and again at the independent recorder;
`compare.mjs` rereads immutable artifacts and validates them independently. A
native session passing is not the same as the entire paired comparison passing.
Stop and diagnose the earliest divergent boundary; never loosen pixels, change
lighting or overwrite a control to produce a pass.

## Versions and source provenance

- Engine source `d0333acdd4443ed9a4a0239d24184755b812b447`, version 0.3.0.
- Three.js vendored `185dev`; exact core/WebGPU bytes and imports are frozen.
- The tested engine source and compiled/dependency bytes are verified against
  the retained worker/component pin chain. No package build, installation or
  compiled/source reconciliation is performed by this preparation.
- Preceding worker-shadow archive: `f852039fbc55289f1edab85003b7a79f42377e92`.
  Its fixture-stage "native pending" report is historical; later native outcomes
  establish the 16-session/48-state pass. Do not reopen its closed defects.
- Coordinator preparation checkpoint `509f25caf9dedf53bb93d04a3eb18f6b39222431`,
  tree `4a20375e6fde1a2a4b99124a04c856a7cea11602`. Local HEAD is not provenance.
- `source-pins.json` includes the source/dependency/helper/derived-file pin chain,
  runtime lockfile, original author sources and retained baseline controls.

## Commands (native commands require separate admission)

For CPU validation, first verify `tools/recovery/cleanup.py` SHA-256 equals
`1c30bc42425c8ee112e7daf42e6a19e80c0f76949f2161590bc74c33b2f8d00d`, then wrap:

```sh
python3 tools/recovery/cleanup.py \
  --root /workspace/scratch/0190a8c72f8a/aperture-tmp \
  --audit-dir "$PWD/benchmarks/crane-combined-edits-20261003/lifecycle-audits" \
  run --job combined-cpu --recreation 'Reproduce bounded CPU tests' -- \
  node --test --test-concurrency=1 \
  benchmarks/crane-combined-edits-20261003/cpu.test.mjs \
  benchmarks/crane-combined-edits-20261003/checks.test.mjs \
  benchmarks/crane-combined-edits-20261003/recorder.test.mjs
```

The same CPU wrapper runs `derive.py --check`, `preflight.mjs <new-report.json>`,
and `freeze.mjs --check`. Preflight checks the real served-module graph without
opening a socket or importing browser modules. It proves the unused audio import
is disabled at the actual pinned generated-app call; nothing is silently skipped.
The final source freeze is exclusive-create; never refresh it after admission.

After separate native permission, reverify frozen hashes and the adopted runtime,
set `APERTURE_WEBGPU_RUNTIME` to the verified existing runtime directory, and run
one explicitly selected engine/session through the lifecycle:

```sh
python3 tools/recovery/runtime_pressure.py \
  --root /workspace/scratch/0190a8c72f8a/aperture-tmp \
  --audit-dir "$PWD/benchmarks/crane-combined-edits-20261003/lifecycle-audits" \
  run --job combined-native-selected --recreation 'Reproduce admitted native session' -- \
  node benchmarks/crane-combined-edits-20261003/run.mjs aperture live attempt-001
```

The other engine is `threejs`; sessions are `live`, `fresh-baseline`,
`fresh-articulation`, `fresh-all`, `fresh-shape-assembly`. Do not run a bulk loop
past a failure. Once all admitted sessions pass, the CPU wrapper may run
`node benchmarks/crane-combined-edits-20261003/compare.mjs attempt-001 comparison-001.json`.
Its output is exclusive-create and retains any failing comparison.

## Alternate views and exclusions

Both original constructors already list the same front-quarter, rear-quarter
and high-oblique camera coordinates. Their live adapters hard-code front-quarter
and expose no dynamic view control. This frozen 36-state experiment therefore
adds no camera-motion or camera-selection axis. After it passes, a separately
admitted small extension can select existing catalog views for cold baseline and
all-combined controls, using an adapter-only selector and a new freeze; no scene
or light redesign is necessary. This is a plan, not an executed alternate-view
validation. It should not silently increase the current session budget.

No continuous RAF, burst commands, jitter, transferable fallback, new material
combinations, hardware-GPU measurements, performance claims, original author
scores, engine changes, new queue item, merge, release or publication is authorized
by this preparation. All old attempts and baseline assets remain immutable.

## Preparation evidence and quiescence

`cpu-*.log` retain every CPU run. `preflight-*.json` records actual served module
paths/hashes and the proof for the single disabled optional import.
`PREPARATION_REPORT.json` and `SHA256SUMS` record the final outcome. CPU geometry
success is never reported as a native WebGPU pass. The worker starts no browser,
server, package build, installation, descendant agent or publication; all bounded
CPU processes run under the adopted lifecycle and return before handoff.
