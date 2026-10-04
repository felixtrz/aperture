# Source-assets-only sideband delivery: bounded CPU probe

## Verdict

**PASS for the existing continuous/SAB and snapshot-wake guarantees. No engine
fix is justified.** Three new CPU cases and three selected existing regressions
pass. No browser, native GPU, engine edit, dependency installation, cleanup
removal, descendant agent, or Git publication occurred.

The runnable probe is [probe.test.mjs](probe.test.mjs); retained final raw results
are [final-001.json](final-001.json) and [final-001.log](final-001.log). The final
wrapper completed exit 0. The final runner verified all 6,525 existing frozen
input pins and 7,085 separately protected source/test/indexed-evidence files both
before and after execution. No protected bytes changed.

## What was actually exercised

The test uses the current source implementations of:

- `mirrorSimulationWorkerSourceAssets`, the actual snapshot/sideband mirror
  wrapper and source asset serialization/commit APIs;
- `createExtractionApp`, one camera, one indexed box and one unlit material;
- `createSharedSnapshotTransportViews`, packet encoding/registry and real SAB
  writes/reads;
- `createWebGpuApp`, its actual RAF scheduler, duplicate-frame guard, preparation,
  resource upload and draw-submission path.

A deterministic manual worker delivers structured-cloned protocol messages, and
a controlled RAF queue invokes callbacks actually scheduled by the app. The GPU
is a CPU mock derived from the existing renderer test harness. The observation
adapter retains submitted vertex/index bytes, buffer identities, draw arguments,
SAB frame, local mirror version, source version and delivered snapshot count.
This is a scheduling/resource-delivery test, **not native rendering**. No shaders
execute and there are no pixels, GPU readbacks or timing/performance claims.

## Results and delivery ordering

1. **Sideband before continuous RAF.** Baseline frame 1 consumes mirror version 1.
   The source changes, SAB frame 2 is written and a separate source-assets-only
   message is delivered. With the snapshot notification deliberately suppressed,
   continuous RAF consumes frame 2 with mirror version 2. Exactly one snapshot
   notification has ever arrived. Changed submitted geometry differs from baseline
   and matches the cold changed-state control byte-for-byte.
2. **Continuous RAF before the sideband.** Frame 2 initially consumes the old
   mirror version 1. Delivering the sideband updates the mirror to version 2.
   A further RAF with the same frozen SAB frame does not resubmit because that
   frame number has already rendered. The continuously publishing producer's next
   SAB frame 3 then consumes mirror version 2, with no second snapshot message,
   and matches the cold changed-state geometry exactly.
3. **Demand/snapshot cadence.** SAB frame 2 alone schedules no callback. Its
   source-assets sideband updates the mirror but also schedules no callback.
   A later legitimate matching frame-2 snapshot notification wakes the renderer;
   it consumes version 2 and matches the cold control. There is no early mismatched
   demand presentation.

Each new case makes a fresh cold changed-state control. Cold raw vertex and index
bytes are also checked directly against `createBoxMeshAsset`'s changed source
arrays, rather than relying only on two renderer runs agreeing.

The ordering boundary in case 2 is retained explicitly as `stationary` in the
result. **A late sideband alone does not invalidate an already rendered SAB frame.**
An application that freezes its producer immediately after that SAB write can
remain visually stale until a newer frame is published. This observation does
not establish cross-frame atomicity, same-frame rerender or automatic
snapshot-mode sideband waking as existing promises. It is not presented as a new
engine regression. The existing continuous producer converges on its next frame.

## Existing controls

[controls-001.log](controls-001.log) records 3 selected passes and 112 intentionally
skipped tests across the existing suites:

- producer: changed source assets travel in a sideband while snapshot messages
  are suppressed;
- browser mirror: sideband assets mirror without increasing snapshot count;
- demand renderer: a newer SAB frame cannot present with an older matching message,
  including supersession before the queued callback.

These focused checks are not a full aggregate repository pass.

## Preserved attempts and limitations

- [cpu-001.log](cpu-001.log) failed all three cases before the actual scenarios:
  its cold-control oracle incorrectly expected the new mirror's local version
  counter to equal source version 2. A fresh mirror's first ready transition is
  version 1, while its geometry already represents source version 2. The original
  test bytes survive in [probe-001.test.mjs](probe-001.test.mjs). Only the probe
  expectation changed; no engine code changed.
- [cpu-002.log](cpu-002.log) passed 3/3 with that correction; its exact test is
  preserved in [probe-002.test.mjs](probe-002.test.mjs).
- [cpu-003.log](cpu-003.log) passed 3/3 after adding direct source-byte and render
  report assertions. Vitest's intercepted output retained no detailed console
  records. [cpu-004.log](cpu-004.log) and the final runner disable only console
  interception and retain six authentic detailed records. No acceptance test was
  weakened to obtain those records.
- Source pins include the inherited audit's immutable inputs plus current package,
  test and indexed-evidence bytes. They do not claim an independent rebuild or
  every installed dependency's transitive source integrity. The installed locked
  toolchain was used without installs.

## Reproduce

From the repository root, use a fresh output stem and fresh wrapper log:

```sh
python3 -B tools/recovery/cleanup.py \
  --root /workspace/scratch/0190a8c72f8a/aperture-tmp \
  --audit-dir "$PWD/benchmarks/sideband-delivery-probe-20261004/lifecycle-audits" \
  run --job sideband-probe-reproduction --recreation 'CPU sideband probe' -- \
  node benchmarks/sideband-delivery-probe-20261004/run.mjs final-002
```

The runner rejects a missing/incorrect lifecycle, checks protected pins before
and after the test and refuses to overwrite result files. Cleanup helper SHA-256:
`1c30bc42425c8ee112e7daf42e6a19e80c0f76949f2161590bc74c33b2f8d00d`.

## Stop and possible next step

This bounded CPU investigation stops here, with no code fix. If separately
approved, the smallest remaining native evidence step is the same one-mesh
continuous/SAB sideband path through `runVerifiedScene`, retaining consumed frame
and asset bytes and comparing changed pixels to one cold changed-state control.
It must preserve the documented late-delivery boundary rather than claiming an
unprovided same-frame atomicity guarantee. Native execution and any capability
change require separate authorization; neither was attempted here.
