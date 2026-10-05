# Minimal source-assets-only native fixture: preparation

## Scope and current status

Prepared from the passed [CPU probe](../REPORT.md). Native execution is **unrun**.
This directory is a frozen candidate for independent review and separate native
permission. It changes no engine or prior evidence bytes. No browser is needed
for its preparation checks.

There are exactly three native sessions, one mesh per session and six captures:

- `before-poll`: baseline frame 1, then changed frame 2 after its source-assets
  sideband arrives, with no second snapshot notification;
- `late-delivery`: baseline frame 1, early frame 2 with old mirrored geometry,
  then changed frame 3 after the delayed sideband. The stationary frame-2
  duplicate guard is recorded between early and converged states, without adding
  a new capture or promising same-frame invalidation;
- `cold-changed`: fresh changed geometry at frame 2.

All sessions use the real compiled extraction, `createSimulationWorker`, an actual
module Worker and MessageChannel, the source-assets mirror, SAB reader and
`createWebGpuApp`. The fixture controls protocol publication, rather than claiming
to test generated-worker cadence selection again. That producer selection already
passed the preceding existing CPU regression.

The continuous renderer's scheduled callbacks are captured during app creation
and released one at a time on real native RAF callbacks. The global RAF API is
immediately restored before startup, so the approved native proof fence retains
its own real presentation waits. This is controlled delivery ordering, not a
wall-clock performance measurement. Camera, transform, one indexed box/material,
1024-square target, 1x MSAA and unlit byte-exact `tonemap: none` stay fixed.

## Evidence and acceptance

A transparent, already-pinned native observer retains actual native draw calls,
command/encoder/submission identities and exact CPU-upload byte snapshots from
successful queue submissions. Every state binds consumed SAB frame, source and
mirror bytes, local mirror version, snapshot count and one native indexed draw.
This is upload observation, not GPU-buffer readback.

PNG captures occur after the approved GPU fence and its two presentation waits.
The existing strict PNG parser requires a nonblank, fully opaque 1024-square RGB
or RGBA image. Decoded RGB comparisons must establish:

1. both baselines and the late early frame are exact matches;
2. before-poll changed, late converged and cold changed are exact matches;
3. baseline and changed differ in at least 1,024 pixels and by at least eight
   channel levels.

The late stationary check preserves the observed limitation: changing the mirror
alone does not resubmit an already-rendered SAB frame. The next SAB frame must
converge, without a new snapshot notification. There is no automatic demand-sideband
wake, cross-frame atomicity, native performance or artistic score claim.

## CPU preparation

Run through the adopted `cleanup.py` wrapper, keeping every attempt log:

```sh
python3 -B tools/recovery/cleanup.py \
  --root /workspace/scratch/0190a8c72f8a/aperture-tmp \
  --audit-dir "$PWD/benchmarks/sideband-delivery-probe-20261004/native/lifecycle-audits" \
  run --job sideband-native-cpu --recreation 'CPU-only native fixture checks' -- \
  node --test benchmarks/sideband-delivery-probe-20261004/native/cpu.test.mjs
```

The CPU tests exercise real compiled extraction/serialization/mirroring and SAB
writes, static pinned browser/worker import closure, the fresh-native-permit gate,
and explicitly synthetic negative controls for record/pixel validation. Synthetic
native records and pixel buffers are test inputs only and are never native results.

`source-pins.json` binds exact current sources, compiled modules, installed native
runtime files and symlink targets, inherited indexed input pins and the preceding
CPU deliverables. It does not claim an independently reproduced build. The runtime
is `.aperture-env/render-runtime` with playwright-core 1.60.0 and Chromium 153.0.0.
The borrowed observer and PNG decoder remain read-only in their original directory.

## Exact separately authorized native run plan

Each session needs its own fresh true begin and matching canonical JSON spec.
The runner rejects the preparation permit. The required spec fields are:

- `session`: exactly one session name above
- `attempt`: `attempt-001`
- `fixturePinsSha256`: the independently verified frozen source-pins digest
- `nativeExecution`: `true`
- `browserRoute`: `runVerifiedScene`
- `writeDomain`: `benchmarks/sideband-delivery-probe-20261004/native/renders/SESSION`

The corresponding begin operation must be `run-sideband-native-SESSION`, kind
`write`, with the bound task/incarnation/current boot, true dispatch permission
and a payload matching sorted two-space JSON plus newline for the complete spec.
These checks are a local guard, not a replacement for the coordinator or platform
approval. A spec alone cannot authorize execution.

Only after that separate permission, run each session under `runtime_pressure.py`:

```sh
APERTURE_WEBGPU_RUNTIME="$PWD/.aperture-env/render-runtime" \
APERTURE_SIDEBAND_BEGIN=/absolute/path/to/fresh-begin.json \
APERTURE_SIDEBAND_SPEC=/absolute/path/to/matching-spec.json \
python3 -B tools/recovery/runtime_pressure.py \
  --root /workspace/scratch/0190a8c72f8a/aperture-tmp \
  --audit-dir "$PWD/benchmarks/sideband-delivery-probe-20261004/native/lifecycle-audits-native" \
  run --job sideband-native-SESSION --recreation 'One admitted frozen native session' -- \
  node benchmarks/sideband-delivery-probe-20261004/native/run.mjs SESSION attempt-001
```

`run.mjs` starts only a trusted numeric-loopback ephemeral server and launches
only `runVerifiedScene`, with the frozen runtime, 1024-square viewport and
180-second stage deadlines. Sources, loaded served-body hashes, accepted/rejected
artifacts, failures and final proof are retained outside disposable scratch.
Existing attempts cannot be overwritten. A timeout is not retry permission.

After all three separately admitted runs finish and their lifecycle completion is
verified, the CPU-only `compare.mjs comparison-001.json` checks retained outcomes,
records and exact decoded pixels. Stop on a real failure, retain the smallest
reproducer and seek separate permission before any source change or additional
native attempt. No engine fix is assumed or prepared here.
