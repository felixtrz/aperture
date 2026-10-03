Revision v2: fixes property-order-sensitive snapshot comparison using authentic attempt-001 evidence. All fields, array order and values remain checked. Native rerun pending. Original fixture and failed attempt are immutable.

# Native same-handle shadow light matrix

Status: CPU-validated fixture; native execution is pending and parent-owned.
This is a bounded extraction/renderSnapshot component regression, not an
independent-author benchmark or a score. It does not test worker transport;
that remains covered separately by the retained crane attempt-005.

## Frozen experiment

- One controlled light-mode axis: directional single map, directional two-cascade,
  spot, and point-array (six cube faces). One shadow-requesting light per scene.
- Identical 512-square camera, single-sample raw tonemap path, hard shadow filter,
  receiver, materials, fixed bounds, and 48-vertex/36-index indexed caster.
  No animation, post-processing, mixed lights, or legacy-submission combinations.
- One persistent native renderer, device, registry, caster entity, and mesh handle
  per live case. No-op frames publish nothing. Vertex edits move the selected box;
  index edits select the second box in the unchanged vertex pool. Bounds, draw
  range, transforms, light requests and snapshot caster packets remain unchanged.
- Nine live frames: baseline, no-op, vertices, vertices no-op, vertex reset,
  indices, indices no-op, index reset, reset no-op. Versions are 1,1,2,2,3,4,4,5,5.
- Three fresh-static cases per mode initialize baseline/vertices/indices directly,
  each with its own clean native context and version-1 asset. No warmed live cache
  is carried into a fresh control. Total: 16 browser sessions, 48 state captures.

The engine remains frozen. The test calls the actual production ECS extraction
and renderer.renderSnapshot boundary with a deliberately inactive transport
adapter. It does not substitute a GPU or claim a browser Worker was used.
The default frame-graph path is fixed; the retained CPU suite covers both paths.

## Evidence and failure gates

Every state retains the exact extracted snapshot, actual completed render report,
frame and asset version, stable native ECS identity, source typed-array numeric
values plus original Uint8 bytes/offset/type/range, observed bound GPU-upload bytes,
renderer shadow cache diagnostics, requested/served light coverage, actual shadow
caster submission counts, native SwiftShader proof, and GPU-fenced canvas PNG.
The unchanged byte-preserving observer from the preceding diagnostic is imported
and pinned rather than rewritten. Upload observations are not GPU readback or
memory-residency measurements.

Changed versions must create a shadow frame with caster-mesh-assets as the first
changed input and positive submitted caster draws. Unchanged frames must reuse it
with zero newly submitted caster draws. Unsupported routes, wrong modes, omitted
requests, wrong frames, changed identities, source drift, or native errors fail.
Records and PNGs are preserved before the page applies the state gate; the server
independently checks every record. Attempts use exclusive creation and cannot be
overwritten. A new attempt ID is required after inspecting any failure.

The offline comparison requires exact decoded RGB equality between each live
state and its fresh-static control, including all resets and no-ops. Each edit
must visibly differ from baseline. This establishes whole-frame correspondence;
it is not separate per-light pixel-occlusion attribution. Transparent, blank or
wrong-size captures fail. Missing native evidence is never inferred from CPU tests.

## Checks already run

- Original fixture: 5 focused Node tests pass.
- Final fixture and fail-closed validation: 10 Node tests pass.
- Existing canonical renderer regression: 16 pass, 85 unrelated tests skipped,
  with --no-cache --configLoader runner. The earlier 178-test aggregate remains
  retained evidence, not a new aggregate run here.
- In-memory pixel comparator: 3 Python tests pass.
- No browser, server, install, package build, engine change, or publication by this
  worker. Initial failed audit-path invocation and spot/point cascade-field test
  assumption, float32 color expectation, and an import-route preflight failure are retained. The corrected tests did not modify engine behavior.

## Parent-only native commands

Run from the repository root, only after source freeze and fresh bounded native
admission. The one approved route is runtime_pressure.py plus runVerifiedScene.
The following preflight is CPU/read-only and starts no server or browser:

```sh
node benchmarks/native-shadow-light-matrix-v2-20261003/run.mjs --check-inputs
```

For the first directional live case:

```sh
export APERTURE_WEBGPU_RUNTIME=/workspace/scratch/0190a8c72f8a/aperture-render-runtime-20261002
python3 -B tools/recovery/runtime_pressure.py \
  --root /workspace/scratch/0190a8c72f8a/aperture-tmp \
  --audit-dir "$PWD/benchmarks/native-shadow-light-matrix-v2-20261003/lifecycle-audits" \
  run --job native-shadow-directional-live \
  --recreation 'Rerun frozen native shadow fixture through runVerifiedScene' -- \
  node benchmarks/native-shadow-light-matrix-v2-20261003/run.mjs directional live attempt-001
```

After examining that retained attempt, repeat the same wrapper for each selected
mode (directional, cascaded, spot, point) and variant (live, fresh-baseline,
fresh-vertices, fresh-indices). Each mode/variant has its own immutable attempt
namespace. Do not rerun the first case into the same directory. Keep actual native
failures and adjust only after a separately admitted source revision.

After all sixteen attempt-001 sessions pass, run this CPU-only comparison inside
the same adopted cleanup lifecycle (no browser needed):

```sh
python3 -B benchmarks/native-shadow-light-matrix-v2-20261003/compare.py attempt-001 comparison-001.json
```

Add --mode directional to compare the first mode after its four cases exist.
The comparison output filename must be new. Native attempts are not included in
the initial worker manifest because they do not exist yet; the parent archives
all actual attempts and results separately.
