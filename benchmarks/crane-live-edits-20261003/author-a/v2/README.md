# Aperture live crane, sole own-feedback revision v2

Exploratory only. No scores, performance claims or GPU-memory measurements.
The immutable v1 source and its failed native attempt remain intact.

## Own native feedback and bounded diagnosis

Own attempt-001 timed out waiting for revision 1 before recording state 0. Its
approved native proof reported one device, worker and canvas, two submissions,
156 draw calls, zero WebGL attempts and no GPU errors. The failure did not retain
which readiness predicate failed, the latest native report, or snapshot transport
status; it cannot establish an exact native root cause by itself.

CPU diagnosis found and reproduced a concrete adapter hazard. Native shared
snapshot publications are rate limited. Requesting 1000 Hz in v1 is clamped by
the unchanged engine to 240 Hz. With tightly coalesced timestamps, the actual
worker loop acknowledges revision 1 and updates its shared snapshot while no
snapshot message carries the revision evidence. A renderer can consume a newer
shared frame while the adapter has no matching tagged publication.

`cpu-v1-clock-race.log` preserves that deliberate CPU-only negative reproduction:
the actual generated worker loop, native MessagePort and actual shared-snapshot
transport acknowledge the baseline command, but only frame 0 is observed without
revision evidence. It is a controlled timing reproduction, not a browser result
or proof that this was the sole cause of attempt-001.

## Exact revision changes

1. Keep the actual app, Worker, ECS world, renderer and native geometry APIs.
   Use a supported native worker full-summary interval of 16 ms and explicit
   deterministic `ecs_step` times `revision / 60` with the unchanged delta
   `1 / 60`. Every requested revision therefore emits a native full-summary
   snapshot even if wall-clock heartbeats coalesce. No scene animation exists;
   geometry, materials, lighting, shadows, camera and renderer configuration are
   unchanged. Published notification rates are honestly specified as 240 Hz.
2. Observe the existing renderer's actual `renderSnapshot` method completion,
   forwarding the original receiver, arguments and result unchanged. Retain the
   exact consumed native snapshot and its original native frame report.
3. Require the actual completed report frame, actual renderer-input snapshot
   frame and original tagged worker snapshot frame to be exactly equal for the
   requested state/revision, with all prior successful 1024-square swapchain and
   positive native draw predicates retained. Neither queue counts nor native
   step acknowledgments can independently pass this gate.
4. Verify every native mesh entity/asset handle and matrix against the actual
   snapshot consumed by the renderer (130 additional checks for 65 meshes).
5. Retain native worker publication, main-thread reception, step acknowledgment,
   renderer completion and per-gate diagnostics. Timeout errors carry bounded
   details so another failure identifies what was missing.

`scene.mjs`, `scene-system.mjs`, `native-evidence.mjs`, `gpu-observer.mjs` and
`index.html` remain byte-identical to v1. No authored geometry, world transforms,
material parameters, light/shadow parameters, camera values or engine sources
were changed. The native continuous wall remains indexed; all other native
nonindexed meshes retain empty actual indices plus their real submesh ranges.

## Evidence

The shared frozen contract still owns sequence, fence, capture, recording and
READY. Each state retains full current scene/source code, actual worker native
vertex/index streams, actual ECS world matrices, genuine IDs, real resource
replacement counters, and actual native GPU upload/binding observations. v2
additionally retains the full actual submitted snapshot. Upload bytes are not
GPU readback, and counters are not residency or memory measurements.

The unchanged native identity definitions and CPU counters are documented in
v1/README.md and emitted with every state. Source geometry stays byte-identical
to the permitted frozen continuous-wall constructor:
`9fa0d6ec7e70ef394cae6d43343bf502964031bed727a65c961e1c63d79eb421`.

## Validation and retained failures

All CPU executions used `tools/recovery/cleanup.py run` under the adopted root.
No browser/server, dependency install or engine/shared-harness mutation occurred.
All actual CPU app instances were disposed; MessagePorts were closed.

- Static syntax checks pass for every v2 module.
- `cpu-geometry-results.log`: 29 states, 261 checks/state, 65 genuine mesh
  identities, 70 ECS entities and exact baseline resets pass. Replacement counts
  remain 524 native assets/vertex arrays and 4 native index arrays.
- `cpu-transfer-results.log`: all 29 revisions pass the real generated worker
  loop and real transferable MessagePort path.
- `cpu-v1-clock-race.log`: expected failed v1 shared-publication race reproduction,
  retained without altering its result.
- `cpu-v2-clock-race.log`: all 29 states pass the identical fixed-wall-clock
  shared-transport condition after the v2 timing/publication change.
- `cpu-v2-report-proof.log`: actual engine report logic on a clearly synthetic
  CPU device passes the strict v2 frame join and 130 actual consumed-snapshot
  checks. Missing publication, wrong revision and wrong rendered frame each
  fail the gate. This is not native WebGPU evidence.
- Earlier diagnostic passes are retained in `cpu-protocol-v1.log`,
  `cpu-shared-v1.log` and `cpu-report-diagnosis.log`.
- `cpu-validation-summary.json` summarizes outcomes; `lifecycle-audits/` retains
  adopted wrapper records. No disposable test fixture was needed.

v1 source hashes reverified unchanged. Native v2 integration is pending the
parent's next authorized attempt and is not claimed successful here. The sole
own-feedback source revision is now consumed. No further source changes are
permitted without a new explicitly changed scope. Source and evidence hashes
are in `revision-submission.json`.

At final freeze the author is quiescent, with no descendants, active browser,
server or owned background process, and no publication performed.
