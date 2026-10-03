# Existing-catalog alternate crane views

This post-author paired regression increases **only the camera-selection axis**.
The prior combined-parameter regression passed 10 native sessions / 36 states,
28 exact live/fresh RGB-and-raw-geometry equalities, six visible mutations and
two retained-baseline equalities. Its preparation report's native-pending status
is historical; `../crane-combined-edits-20261003/comparison-001.json` and retained
native artifacts establish the subsequent pass. All old sources and images remain
unchanged. The durable predecessor is `df4b5b249d8966bb4f74b734a6b3f6fc3abd3786`.

## Planned eight cold sessions

Each engine directly initializes baseline and all-combined poses at both existing
catalog views: rear-quarter `[-8,5,-9]`, high-oblique `[6,11,5]`. Target remains
`[0,1.4,0]`, vertical span 10.5, orthographic aspect 1. Aperture retains near/far
0.1/80; Three.js retains 0.1/100. These intentional inherited renderer differences
are not equalized. Each session has one 1024-square native capture, one immutable
attempt-001 budget, a 240-second session cap and inherited 180-second state cap.
Caps are failure deadlines, not performance budgets. No live camera motion,
continuous RAF, burst commands, transport fallback or extra sessions are planned.

The four session IDs, applied to each engine, are:

- `rear-quarter-baseline`
- `rear-quarter-all`
- `high-oblique-baseline`
- `high-oblique-all`

## Exact mechanical derivation

`derive.py`, `derivation.json` and `derivation.diff` record every original/derived
byte. Scene constructors, geometry, materials, lights, pose definitions, workers,
raw byte observers, renderer settings, state cadence, PNG decoder/recorder and
client frame capture remain byte-identical to the combined fixture. HTML titles
also retain their historical combined-regression labels; folder/schema/session
receipts identify this extension. No engine code, catalog or previous file changes.

The changed adapters select the existing catalog camera, report its selected name,
and retain actual native camera matrices. The runner keeps its approved immutable
recording and `runVerifiedScene` invocation; only the default session literal,
two additional static fixture-module routes and descriptive scope change.
`pose-contract.mjs` is an exact copy of the combined parameter contract.

## Camera gates are actual evidence, not relabeling

`camera-gate-audit.json` lists the affected boundaries. Aperture extracts matrices
from the exact snapshot already observed at successful native renderSnapshot
completion and ties them to the admitted receipt/frame. Three.js observes the
actual camera passed to native scene before/after callbacks and compares those
matrices to the post-render camera evidence and same native revision/camera ID.

Independent look-at and orthographic formulas check view, projection and combined
matrices. Matrix tolerance is the inherited geometric precision 2e-5 for float32
transform/extraction rounding; geometry/raw streams and retained bytes use exact
equality. A stale front-quarter view with altered labels fails. Three.js keeps its
default CPU camera convention until the actual renderer switches it to WebGPU;
the native gates require the WebGPU convention observed in both callbacks.
No projection/rendering settings are changed by evidence collection.

Browser, independent recorder and offline comparison each apply selected-view,
pose, transport, matrix, raw-byte, native proof, identity, frame and opaque/nonblank
PNG gates. Native geometry/readback/upload mechanisms and limitations are inherited.
Aperture evidence is actual upload observation, not GPU readback; Three.js retains
native GPUBuffer readback. Neither establishes GPU memory or performance.

## CPU preparation and pinned controls

CPU tests execute the real Aperture ECS/extraction and native Three.js camera,
Mesh/BufferGeometry constructors. For both poses, actual geometry and raw streams
remain exact against unchanged front-camera constructors; actual view matrices
change and projection matrices retain their original per-engine definitions.
Native matrix formula expectations are independent of either engine.
Negative tests reject wrong view/pose, relabeled front view, matrix/frame errors,
fallback transport, malformed/blank/transparent PNGs and wrong-view recorder input.
Synthetic fixtures are explicitly unit inputs, never alternate-view native proof.

`source-pins.json` verifies the inherited 0.3.0 source/dist/dependency chain, exact
Three.js 185dev bytes, approved runner/lifecycle helpers, every derived source,
the four genuine combined front-view cold controls including old PNG/JSON bytes,
and predecessor native comparison. Source checkpoint is
`097c94acba41431a27cd3030c68d3a6b58db3f4f`, tree
`cb15bb722b8a0bf63fe6a392794f19eab7d2c22e`; local HEAD is not provenance.
No build or dependency reconciliation was performed.

Before every CPU command, verify `tools/recovery/cleanup.py` SHA-256 is
`1c30bc42425c8ee112e7daf42e6a19e80c0f76949f2161590bc74c33b2f8d00d`, then use:

```sh
python3 -B tools/recovery/cleanup.py \
  --root /workspace/scratch/0190a8c72f8a/aperture-tmp \
  --audit-dir "$PWD/benchmarks/crane-alternate-views-20261003/lifecycle-audits" \
  run --job views-cpu --recreation 'Bounded alternate-view CPU checks' -- \
  node --test --test-concurrency=1 \
  benchmarks/crane-alternate-views-20261003/cpu.test.mjs \
  benchmarks/crane-alternate-views-20261003/checks.test.mjs
```

The wrapper also runs `derive.py --check`, `preflight.mjs <new-report.json>`,
`prepare-freeze.mjs` and `freeze.mjs --check`. The one-time source freeze is
exclusive-create and cannot be refreshed after admission. All preparation failures
and lifecycle receipts are retained; full root validation was outside this bounded
fixture preparation and is not claimed.

## Separately admitted native stage, currently unrun

Only after parent admission, verified immutable pins and verified adopted runtime:

```sh
python3 -B tools/recovery/runtime_pressure.py \
  --root /workspace/scratch/0190a8c72f8a/aperture-tmp \
  --audit-dir "$PWD/benchmarks/crane-alternate-views-20261003/lifecycle-audits-native" \
  run --job views-native-selected --recreation 'Admitted cold native view' -- \
  node benchmarks/crane-alternate-views-20261003/run.mjs \
  aperture rear-quarter-baseline attempt-001
```

Set APERTURE_WEBGPU_RUNTIME to the verified existing runtime. Use one selected
engine/session at a time; the other engine is `threejs`. Stop on the first real
mismatch and preserve artifacts. Do not change definitions, loosen gates, replace
old images or retry native failures under the same admission. Adapter changes
require a new identified freeze and parent admission. Approved runVerifiedScene
is the only browser route. This preparation starts no browser or server.

After all eight sessions pass, run `compare.mjs attempt-001 comparison-001.json`
under cleanup.py. It independently rereads acknowledged JSON/PNG bytes, requires
eight exact same-pose geometry/raw/appearance matches to the old front controls,
eight visible camera changes, four visible pose changes at fixed alternate views,
and four visible changes between alternate cameras. Appearance comparison omits
only native object `id` values, not authored material/light properties.
There is no expected pixel equality between different cameras or across engines.

Finally obtain separate independent qualitative inspection of all eight genuine
images, including framing, silhouette, rear-side topology, arch/pipe continuity,
articulation, hoist/load, assembly and shadow behavior. Record view-dependent
occlusion and failures without silently redesigning the scenes. Numerical image
change alone proves no visual-quality outcome. Original author transcript and
model/settings parity blockers remain; no formal author scores or engine ranking.

No native pass, visual judgment, publication, engine modification, installation,
build, descendant agent, merge or release is performed by this preparation.
