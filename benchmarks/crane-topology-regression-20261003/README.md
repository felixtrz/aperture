# Hollow-pipe topology regression, 2026-10-03

This is a new **post-author exploratory engineering regression**. CPU preparation
is separate from native execution. It is not an original author result, scored
benchmark, engine ranking, performance comparison or GPU-memory measurement.
Native browsers/renders have not been run by the fixture builder.

## Frozen axis and session budget

Only hollow-pipe curve/radial tessellation cardinality changes:

- baseline: 12 curve intervals, 12 radial sides
- grow: 24 curve intervals, 16 radial sides
- shrink: 6 curve intervals, 8 radial sides

The quarter-circle bend radius remains 0.8; outer/inner radii remain 0.24/0.175.
Both engines retain baseline articulation, analytic dimensions, nonpipe geometry,
front-quarter camera, lighting, material and renderer settings. Camera is
[8, 6.5, 10], target [0, 1.4, 0], vertical span 10.5, canvas 1024×1024.
The constructors are mechanically derived from the successful combined fixture.
The original baseline full constructor outputs and actual native CPU geometry
bytes equal the original and retained successful native baseline controls exactly.
Aperture and three.js appearance remains independently authored.

Each engine runs one live session: baseline → baseline no-op → grow → grow no-op
→ shrink → reset → grow → reset. Three independent cold sessions initialize
baseline/grow/shrink directly before renderer resources exist. Total: four
sessions and eleven captures per engine; eight sessions and twenty-two captures
paired. State deadline 180 seconds; live session deadline 900 seconds; each cold
session deadline 240 seconds. These are failure deadlines, not latency budgets.
One immutable attempt-001 per admitted session. Stop on the first mismatch;
retain all failed/partial attempts. A changed fixture needs a new freeze/admission.

## Implementations and evidence

- Aperture preserves real ECS entities and MeshHandle identities, publishes
  changed pipe MeshAssets through meshes.publish, and records genuine asset
  versions and typed-array bytes. The live CPU sequence performs 15 pipe asset
  replacements: three parts on each of five transitions. No-op replaces none.
  Native GPU buffers may legitimately be replaced as topology/layout changes.
- three.js preserves actual Mesh identity. Its inherited cardinality-changing
  path creates a new BufferGeometry and three BufferAttributes, installs them,
  and disposes the previous geometry. The CPU live sequence observes five real
  geometry replacements/dispose events and fifteen attribute replacements.
  Nonpipe geometry/attribute references remain unchanged. All cold counters start
  at zero replacements. No in-place attribute resizing is attempted.
- Native byte evidence is retained unchanged: Aperture observes actual native
  typed-array bytes and successful bound queue uploads (not GPU readback);
  three.js reads actual renderer-owned GPU buffers and compares worker-source and
  installed CPU raw bytes. Signed-zero byte corruption remains a failing gate.
- Additional transparent observer joins draw/drawIndexed commands to the owning
  GPUCommandEncoder, the actual finished GPUCommandBuffer and the exact list in
  successful GPUQueue.submit. Executed render bundles retain their commands;
  executeBundles resets tracked pass bindings as required. Evidence is captured
  inside the correlated native renderer call. Orphan encoded/unsubmitted passes
  and unrelated submissions cannot satisfy the draw gate. Indirect draws cannot
  satisfy this fixture's direct-count proof. Buffer object references have stable
  observer labels, not invented engine identities.
- Active draw counts and index/vertex binding ranges must match the current pipe.
  Allocation capacity may exceed active bytes; excess retained capacity alone is
  not an error. Aperture checks nonindexed vertex ranges. three.js checks indexed
  material-group ranges, index format, buffer identity and coverage.
- Existing native worker/revision/frame joins, SAB-only Aperture transport, one
  Worker/device/canvas/session, real swapchain proof, no WebGL/errors/device loss,
  source pin checks, exact upload-to-submitted-buffer object identity joins, immutable recorder receipts, opaque nonblank PNG validation
  and exact reset checks remain mandatory. No engine code is changed or gate
  weakened to produce a pass.

## Independent validation and controls

Variable ring counts and radial cardinality are checked against a separate
analytic model using actual native positions. Validation-only coordinate welding
checks every edge has two opposite uses, Euler characteristic zero, nondegenerate
triangles and both hollow openings with six ray tests. It never modifies native
arrays. Exact nonpipe bytes, source/native counts, real replacement deltas,
versions/identities, draw ranges and reset geometry are checked independently.
Negative CPU controls include stale original counts, truncated position/raw
buffers, incorrect indices/rings/ranges, changed dimensions, failed resets,
unaccounted replacements, absent/stale native draw correlation, orphan commands,
unrelated submissions, bundle replay and capped openings. Recorder tests retain
immutable/ordered artifacts and reject invalid bytes, PNGs, counts and receipts.
Synthetic observer/recorder unit inputs are explicitly not genuine GPU evidence.

The eventual offline comparison requires 16 within-engine live-versus-cold
exact raw-geometry and decoded-RGB equalities, four visible topology mutations,
and two exact retained-baseline RGB controls. No cross-engine pixel equality.
Raster/reset equivalence remains unrun until native admission; CPU results do
not establish native submission or raster success.

## Provenance and freeze

- Aperture source d0333acdd4443ed9a4a0239d24184755b812b447, version 0.3.0.
- Vendored three.js 185dev, exact existing core/WebGPU dependency bytes pinned.
- Combined native archive df4b5b249d8966bb4f74b734a6b3f6fc3abd3786.
- Alternate-view native archive fe400624895c118396d8432d6d55bf50db54b48a is prior
  evidence, not a topology control or a claim of changed cameras.
- Main observed at admission: 1f04da792a38e259b51f5053b0731c5013a34c6b.
  Stale local HEAD is not provenance. No reset, install, build or source/dist
  reconciliation was performed.

`derive.py --check` reproduces every exact-once change and verifies derivation.json
and derivation.diff. SOURCE_TRACE.json records the supported API/source paths.
source-audit-final.json checks every final inherited copy against actual Git archive bytes; source-audit.json preserves the earlier receipt before runtime-only runner pin additions.
frozen-contract.json freezes settings and states. source-pins.json freezes the
full inherited source/dependency/controls plus this fixture and every actual installed runtime file and symlink. The runtime is frozen to .aperture-env/render-runtime; no package is installed or executed by pinning. Every earlier
failure log is retained. Never refresh frozen inputs after native admission.

## Parent commands

Verify cleanup.py SHA-256 is
1c30bc42425c8ee112e7daf42e6a19e80c0f76949f2161590bc74c33b2f8d00d.
From repository root, CPU checks use the adopted lifecycle (unique audit files):

```sh
python3 tools/recovery/cleanup.py \
  --root /workspace/scratch/0190a8c72f8a/aperture-tmp \
  --audit-dir "$PWD/benchmarks/crane-topology-regression-20261003/lifecycle-audits" \
  run --job topology-cpu --recreation 'Reproduce frozen topology CPU gates' -- \
  node --test --test-reporter=tap --test-concurrency=1 \
  benchmarks/crane-topology-regression-20261003/cpu.test.mjs \
  benchmarks/crane-topology-regression-20261003/checks.test.mjs \
  benchmarks/crane-topology-regression-20261003/observer.test.mjs \
  benchmarks/crane-topology-regression-20261003/upload-observer.test.mjs \
  benchmarks/crane-topology-regression-20261003/recorder.test.mjs
```

The same wrapper may run derive.py --check, freeze.mjs --check or
preflight.mjs with a new report basename. Preflight resolves/parses served modules
and proves the disabled optional audio import without a socket/browser.

After separate native admission, reverify pins and the adopted runtime helper,
use the frozen existing runtime at $PWD/.aperture-env/render-runtime,
and run exactly one selected session:

```sh
APERTURE_WEBGPU_RUNTIME="$PWD/.aperture-env/render-runtime" \
python3 tools/recovery/runtime_pressure.py \
  --root /workspace/scratch/0190a8c72f8a/aperture-tmp \
  --audit-dir "$PWD/benchmarks/crane-topology-regression-20261003/lifecycle-audits-native" \
  run --job topology-native-selected --recreation 'Reproduce admitted frozen topology session' -- \
  node benchmarks/crane-topology-regression-20261003/run.mjs aperture live attempt-001
```

The selected engine is aperture or threejs; session is live, fresh-baseline,
fresh-grow or fresh-shrink. run.mjs calls only runVerifiedScene. No other browser
route is allowed. Do not run a bulk loop past a failure. After all eight admitted
sessions pass, use the CPU wrapper to run:

```sh
node benchmarks/crane-topology-regression-20261003/compare.mjs attempt-001 comparison-001.json
```

The comparison is exclusive-create and retains failure. Final completion also
requires lifecycle proof that browser/server/owned descendant processes settled.
