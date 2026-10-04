# Independent shared-mesh V2 native audit

## Finding

PASS for this bounded exploratory engineering fixture. No engine defect was
established. Seven retained native SwiftShader WebGPU sessions contain 14 valid
captures. All 11 exact decoded-RGB/raw-geometry controls pass independently.
Grow and shrink differ from baseline by 17,002 and 19,392 pixels respectively.
These are distinct counts: 14 captures, 11 equality controls.

The native evidence correction is supported. Every shared pipe group uses an
actual `drawIndirect` with three instances. In the live session the exact
argument GPUBuffer is object 51, with offsets 0/20/40 and nonindexed 16-byte
payloads. Its observed content version advances from 1 through 8 at submissions
1 through 8. Decoded first instances are 0/3/6. Vertex counts for inner/outer/rims
are 864/864/144 at baseline, 2304/2304/192 at grow, and 288/288/96 at shrink.
Actual buffer identities, owning command/encoder, submission serial, initialized
argument ranges, preserved bytes, current active vertex data, and packed world
matrices all agree. The same-label shortcut is not used as an identity proof.

Baseline and both no-op states execute indirect calls through cached bundles.
Topology-change states execute genuine indirect calls directly in the pass.
Neither route is relabeled as a direct `draw`. The observer sees CPU uploads at
submission; this is not GPU argument readback.

All persistent entities, mesh/material handles, transforms, mirrors and prepared
cache source versions agree. Live mutable versions are 1,1,2,2,3,4,5,6, with
0,0,3,3,6,9,12,15 cumulative once-per-handle publications. No-ops allocate no
geometry buffers and reuse the exact prior sampled shadow content. The retained
geometry cache grows 5 → 8 → 11 entries for the three layouts; later resets and
regrowth create zero prepared mesh buffers. This is a bounded cache observation,
not a GPU-memory or performance measurement.

## Independent checks

- `audit.py` imports no fixture validation code. `independent-002.json` records
  raw argument decoding, all submitted geometry/transform joins, mirrors,
  versions, shadow history/content joins, native proof, capture gates and pixels.
- 3,430 file pins and 48 runtime symlinks match. All 88 source files in frozen
  commit `31e06f7c7ca0ca53b12bc42b0a759a668ade6bb7` match actual local bytes.
- The native manifest's 212 files / 66,060,889 bytes match size, SHA-256 and Git
  blob IDs. Including the manifest itself, all 213 archived fixture files /
  66,113,316 bytes match commit `f3cd9ea2ac7be3b178b024267484fc05929b1c02`, tree
  `fdbb1b5f79501cacc952cf1b09797d9d599e021b`. This worker verified immutable local
  Git objects. The parent separately verified the remote ref and CI.
- V1's 93 files / 5,871,362 bytes and its archived checkpoint remain exact.
  The successful topology archive's 265 files / 93,281,732 bytes remain exact.
  V1's failed attempt is neither repaired nor reclassified as native success.
- `replay.mjs` reruns the frozen validators over all 14 states, independently
  recomputes 6,559 served module bodies across seven sessions, and rejects 11
  mutations of in-memory copies of actual native records. The tests cover wrong
  object/submission/count/instance/range/usage, stale geometry, missing instances,
  stale mirrors/transforms and invalidated shadows.
- The frozen CPU suites pass 59/59 tests. They include signed indexed arguments,
  changed submit-time versions, failed submissions, bundle replay, partial writes,
  and conservative invalidation of GPU-written/copy/clear/query destinations.
- Native runner receipts show exact approved flags, sandbox enabled, one native
  SwiftShader device/canvas, zero WebGL attempts, no device loss or GPU errors,
  and successful completion. Each native executable's run identity joins its
  own completed lifecycle record. Every audit lifecycle also settles.

## Actual-image inspection

The auditor opened the original live baseline, grow and shrink PNGs. Each shows
three separate hollow elbow instances on the same slab, the same box sentinel,
and cast shadows. Grow has smoother segmentation; shrink has visibly coarser
facets and rims. No image was generated, altered or substituted. Inspection
supports visibility and scene identity only; no artistic score was assigned.

## Preserved audit failure

`independent-001.log` and its nonzero lifecycle exit are retained. The first
independent script incorrectly required every indirect draw to come from a
bundle and stopped with `KeyError: 'viaBundle'` on an actual pass-encoded call.
Only the auditor's assumption was corrected: require genuine indirect calls and
three instances, while recording the actual optional bundle route. No source or
evidence bytes were changed. `independent-002.json` is the successful rerun.

## Missing or unrun gates

- No new browser/native execution was authorized or performed by this auditor.
- Native indexed fan-out is unrun. The retained scene is entirely nonindexed;
  indexed 20-byte decoding and signed baseVertex have CPU coverage only.
- GPU-written indirect arguments/readback, hardware GPU portability, source-to-
  compiled independent rebuilding, performance and memory benchmarking are unrun.
- Authentic original-author transcripts, exact model/settings parity, blind
  artistic scoring, and cross-engine comparisons remain unavailable/unclaimed.
- Preparation README/REPORT files still say native work is pending because their
  bytes were frozen before execution; later native manifests, receipts and this
  audit establish current status without rewriting that history.

## One next scenario

Run a separately frozen native indexed shared-mesh fan-out fixture using actual
20-byte `drawIndexedIndirect` arguments, with the same grow/no-op/shrink/reset and
shared-versus-unshared controls. Require index-buffer object/format/range joins
and packed transforms at each submission. The present audit shows this native
coverage is missing despite CPU decoder coverage; it does not establish an
indexed engine failure or justify an engine change.

## Scope and reproducibility

Only `benchmarks/shared-mesh-native-audit-20261003` was written. No fixture,
engine, archive, runtime, dependency, browser configuration or external state
was changed. No agent descendants, installs, browsers or cleanup deletion ran.
`receipts-001.json` binds all native and completed audit lifecycle observations;
`QUIESCENCE.json` records the final worker scope.

From the repository root, run `bash benchmarks/shared-mesh-native-audit-20261003/run-cpu.sh`
for the 59 CPU tests. For the independent audit, replay and receipts scripts,
use the command form below and a new output basename (the scripts refuse output
replacement). Redirect each invocation to a new log inside this audit folder.

```sh
python3 -B tools/recovery/cleanup.py \
  --root /workspace/scratch/0190a8c72f8a/aperture-tmp \
  --audit-dir "$PWD/benchmarks/shared-mesh-native-audit-20261003/lifecycle-audits" \
  run --job shared-mesh-audit-reproduction --recreation 'CPU-only audit reproduction' -- \
  python3 -B benchmarks/shared-mesh-native-audit-20261003/audit.py independent-003.json
# Substitute the command after -- with either:
# node benchmarks/shared-mesh-native-audit-20261003/replay.mjs replay-002.json
# python3 -B benchmarks/shared-mesh-native-audit-20261003/receipts.py receipts-002.json
```

Before any run, verify cleanup.py SHA-256 is
`1c30bc42425c8ee112e7daf42e6a19e80c0f76949f2161590bc74c33b2f8d00d`.
The native wrapper was hash-verified at
`89b5819db930e2bebe72818ee199de26306550327db358e7319f2d67c5aedf8a`
but never invoked by this auditor.
