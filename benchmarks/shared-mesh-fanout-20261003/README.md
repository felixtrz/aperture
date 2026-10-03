# Shared-mesh fan-out and draw coalescing

CPU-prepared exploratory Aperture regression. Native rendering has not run.
This is the single recommendation in the independently audited topology packet.
Authentic original-author transcript/model gates remain unavailable.

## Frozen scene and boundary

Three copies of the existing three-part hollow pipe produce nine persistent ECS
entities sharing exactly three explicit MeshHandles and three corresponding
MaterialHandles. A slab receives shadows, and the unrelated crate body is the
static sentinel. One directional shadow light, eleven fixed transforms, existing
camera/render appearance, SAB and demand cadence remain fixed. Unshared cold
controls change only the per-entity mesh handles, keeping geometry and materials
identical. No renderer option is invented to disable batching.

Tessellation is baseline 12×12, grow 24×16, shrink 6×8. Shared live versions are
1,1,2,2,3,4,5,6, with exactly 15 mesh replacements across five real transitions.
No-op states publish nothing. Shared cold/unshared cold initialize directly.

## Acceptance and evidence

- Every actual worker entity, mesh/material handle, version and fixed matrix joins
  the exact consumed snapshot, main-realm mirrored asset and completed frame.
- Actual native pass/bundle draws join owning command encoder, successful finish,
  exact submitted command-buffer object, bound GPUBuffer object and preserved
  upload bytes at that submission. These are upload observations, not GPU readback.
- Actual pass descriptors and source-pinned shader code classify color/main and
  shadow/depth passes. Main pipe draws must genuinely coalesce three instances;
  world-transform group/binding and firstInstance select exact packed matrices.
- Shadow history retains the original submitted frame/command/texture and may be
  reused only while the current color pass samples that exact texture and its
  geometry/matrices still match. Clear-only, overwrite, discard, copy/write or
  destruction invalidates old depth coverage. No-op reuse invents no new draw.
- Byte snapshots deduplicate by actual buffer object ID plus submission serial.
  Pipeline descriptors likewise deduplicate by actual pipeline identity.
- Strict active geometry/binding ranges, all nine instances, sentinel/no-op/reset
  bytes, native SwiftShader, exact approved flags, one worker/device/canvas, zero
  WebGL/errors/device losses, immutable artifacts and cleanup are mandatory.
- Independently decode fourteen PNGs: eight live/shared-cold and three
  shared/unshared exact RGB/raw-geometry controls, plus visible grow/shrink edits.

Native mismatch or missing main coalescing stops the attempt, preserving evidence.
A coverage blocker is not automatically an engine defect. No retries, relaxed
gates, engine patches, dependency reconciliation, extra sessions or new queue
items follow under this freeze. A changed fixture requires a new freeze/admission.

## Provenance

Engine source d0333acdd4443ed9a4a0239d24184755b812b447, version 0.3.0.
Predecessor source 7c4b867ac432bfbb132c58066b809c530e785032; native archive
8a2e900edd794d0392b133c332a3f1ba161f8302; audited intent
b2051f0c0e5ce55ff7569f1da996f9656da54542. Local HEAD is not provenance.
All inherited source/dependency/runtime/helper pins are checked. Installed
compiled bytes retain inherited pins; no new build or independent reproduction
of those bytes was performed. Previous evidence is untouched.

## Parent commands after separate admission

Working directory: /workspace/scratch/0190a8c72f8a/aperture-recovery-20261002

Every native session below requires its own authorization and only attempt-001.
Replace SESSION once with exactly one of the seven admitted session names:
live, shared-baseline, shared-grow, shared-shrink, unshared-baseline,
unshared-grow, unshared-shrink. Do not run a shell loop that starts them all.

    APERTURE_WEBGPU_RUNTIME="$PWD/.aperture-env/render-runtime" python tools/recovery/runtime_pressure.py --root /workspace/scratch/0190a8c72f8a/aperture-tmp --audit-dir "$PWD/benchmarks/shared-mesh-fanout-20261003/lifecycle-audits-native" run --job shared-mesh-SESSION-attempt001 --recreation 'Reproduce separately admitted frozen shared-mesh SESSION attempt' -- node benchmarks/shared-mesh-fanout-20261003/run.mjs aperture SESSION attempt-001

The runner exclusively calls scripts/verified-webgpu.mjs runVerifiedScene. It
starts no alternate browser and does not change the approved flags.

After all seven successful sessions, run each CPU check through cleanup.py
and the same root with a new audit job name: node
benchmarks/shared-mesh-fanout-20261003/revalidate.mjs, then python
benchmarks/shared-mesh-fanout-20261003/compare.py comparison-001.json.
Stop on failure and preserve its original files. Passing this bounded regression
implies no score, ranking, performance/memory claim, merge or release.

Native wrapper SHA-256: 89b5819db930e2bebe72818ee199de26306550327db358e7319f2d67c5aedf8a. It adds low-space checks and pinned Chromium runtime registration. CPU checks use cleanup.py, not this native wrapper.
