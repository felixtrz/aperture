# Worker-delivered same-handle shadow matrix

Status: fixture preparation only. Native execution is pending a separate parent
admission. The engine stays at the audited source identity
`d0333acdd4443ed9a4a0239d24184755b812b447`, version 0.3.0. This is an exploratory
worker/mirror/SAB/demand integration regression, not an author score or release.

## Frozen experiment

Only the transport boundary increases in complexity relative to
`../native-shadow-light-matrix-v2-20261003`. The four modes, camera, materials,
lights, bounds, 48-vertex/36-index caster, receiver, layer masks, raw tonemap,
single sample, hard shadow filter and frame graph remain exact. Generated-app
camera/light/environment defaults are explicitly disabled. No lighting retuning,
continuous animation, burst edits, performance or memory axis is introduced.

There are 16 independent browser sessions and 48 state captures:

- Four modes: directional, two-cascade directional, spot, six-face point-array
- Nine live states: baseline, noop, vertices, vertices-noop, vertex-reset,
  indices, indices-noop, index-reset, reset-noop
- Live mesh versions: 1,1,2,2,3,4,4,5,5
- Three fresh worker controls per mode: baseline, vertices, indices, version 1

One generated app, native Worker, persistent generated ECS world/registry,
caster entity/mesh handle, canvas and WebGPU device serve each live session.
The worker uses the published public createSimulationApp authoring facade with
its existing generated world/registry solely to reproduce the exact initializer
calls. That facade never steps, extracts, serializes or supplies snapshots.
Generated-app code owns all those production boundaries. Later edits use the
system's supported this.meshes.publish. Replacement assets/arrays are counted as
replacements; they are not called in-place authoring or memory measurements.

## Startup and deterministic states

All WebGPU initialization awaits in the pinned generated browser app precede its
final app.start(), demand scheduling and immediate return. There is no await
between start and return. The awaiting main continuation therefore installs its
observers in the same microtask checkpoint before Worker/MessagePort/RAF tasks
can run. The module preflight guards that compiled-source ordering premise.

Initial resize and generated demand steps can coalesce, so the fixture never
requires frame zero/one or the first bootstrap request to have been presented.
Two RAF callbacks cross the already scheduled startup/resize callbacks; this is
scheduling synchronization, not frame proof. Then an actual supported ecs_step
request with delta 0/time 0 establishes a separately acknowledged and observed
empty bootstrap barrier. Its actual received/consumed/completed frame is joined
and retained. No authored mesh or shadow request may exist on that frame.

The exact five scene entities and four assets are created on the first matrix
command, keeping baseline shadow caches cold. This is scene initialization timing,
not a change to any captured scene. Each subsequent state uses one command and
one ecs_step with delta 1/60 and time revision/60. No-op states still request and
observe a production snapshot/presentation without publishing assets. A command
is never issued until the preceding state's matching GPU-fenced capture passes.

Requested worker settings are entityCapacity 16, sharedSnapshotMessageRateHz 240,
sourceAssetsMessageRateHz 240, workerFullSummaryIntervalMilliseconds 16. Actual
nested start-message values, native SAB header type, generated simulationPaused,
summary cadence and runtime transport diagnostics must agree. No nonexistent
generated-app transport option is used. Transferable fallback fails closed.

## Evidence and gates

The worker transparently observes the actual native MessagePort publication,
retaining engine-owned payloads and transfer lists. It adds state/revision,
original Uint8 mesh bytes, asset versions, native entity identity and replacement
counters. The main thread observes native Worker construction and scope, actual
source-asset reception, and the production renderSnapshot call's input/completion.
It never manually calls the renderer, injects a snapshot event, imports an
authoritative registry, or reconstructs float evidence from JSON numeric arrays.

Every accepted state joins publication frame, received message/snapshot frame,
consumed snapshot frame, completed report frame and the deterministic step ack.
It retains actual generated settings, swapchain submission, GPU fence, upload
bytes, snapshot inputs, shadow pipeline/cache diagnostics, request coverage,
caster submissions and native device/canvas/SwiftShader proof. Original worker
bytes must equal both delivered mesh bytes and both bound native upload views.
Asset publications are exactly four initially, one for edits/resets and zero for
no-ops. World/registry/caster references are checked inside the worker.

Each edit/reset must invalidate first through caster-mesh-assets and submit
casters. No-ops must reuse the shadow frame and submit zero new caster draws.
All eight frozen snapshot sections stay exact across live states. Wrong state,
revision, frames, missing asset versions/publications/bytes, fallback, missing
light requests, shadow/cache/identity drift, WebGL, GPU error or device loss fails.
The recorder independently revalidates retained records. JSON/PNG files are
exclusive-created and acknowledged by exact byte length/SHA-256. Failures retain
partial publication/reception/completion traces and already captured artifacts.

The offline comparator requires 36 exact decoded RGB live/fresh equalities,
eight visible edits, plus 12 exact worker-fresh/component-fresh equalities against
the old retained attempt-001 images under matching engine/dependency pins. Images
must be opaque, nonblank and 512-square. Tolerances and old goldens never change.

Worker termination is a witnessed native terminate invocation and renderer
cleanup is awaited. They do not claim OS descendant/browser cleanup: the adopted
runtime_pressure lifecycle and verified browser runner provide that separate
parent-owned evidence. Stop at the first mismatch and retain the attempt. A
changed fixture needs a new identified source freeze and fresh admission.

## CPU checks and provenance

The focused Node suite covers exact generated-ECS/component authoring across all
16 sessions and 48 states, source-byte preservation, reserved world identity,
command serialization, 37 corrupt worker/native records, signed zero, structural
comparison and production nested-start settings. Synthetic worker proof fields
in validator tests are explicitly not native execution evidence. The pixel tests
are in-memory CPU checks only.

cpu-001.log retains the first failed attempt: the fixture tried to assign the
system's reserved resources getter. Renaming that fixture counter field fixed it;
no engine code changed. cpu-002.log records 66/66 passing checks before the final
nested-start observer regression was added. cpu-final.log records 67/67 passing checks. import-proof.log adds eight
passing active-graph/disabled-edge tests, including seven negative cases.
All CPU invocations use the hash-verified cleanup.py lifecycle with audit logs
here. Scratch is exclusively the authorized aperture-tmp root; direct Node avoids
pnpm dropping its inherited lifecycle lock FD. No package build or installation
is performed, and no prior fixture or evidence is overwritten.

source-pins.json freezes every actual retained component source/dependency pin,
all new executable fixture inputs, imported byte/GPU/frame helpers, CPU parser,
component control evidence and an exact scene byte contract. It intentionally
uses the audited engine source commit rather than stale local HEAD. Compiled
inputs are checked against retained component hashes; this does not claim a new
reproducible build. Native settings are checked before capture and pins are
rechecked after each attempt. preflight-final.json resolves active static and literal
dynamic browser imports using the same rewrite/path resolver without starting a
server. Nonliteral optional engine imports, if any, are reported explicitly. The initial
preflight also traversed disabled audio and found its unmapped bare package
import; preflight-001.log and source-pins-preflight-001.json retain that failure.
The final preflight explicitly excludes only the audio dynamic import guarded by
the absent config/option, recording why it cannot execute. The compiled dynamic import is at browser/app.js:110 inside its line-109
enabled-audio guard; option resolution returns undefined for absent config.
import-proof.mjs validates that AST, the resolver and the exact browser call,
and its negative tests reject enabled audio, static imports, removed guards,
changed resolution, overrides and unproven option spreads. No engine/server
rewrite map was changed to accommodate that inactive branch.

## Parent-only execution

Do not run native commands without the separate bounded admission. From repo root:

    node benchmarks/worker-shadow-light-matrix-20261003/run.mjs --check-inputs
    node benchmarks/worker-shadow-light-matrix-20261003/preflight.mjs

First native case, only through the approved route and adopted lifecycle:

    export APERTURE_WEBGPU_RUNTIME=/workspace/scratch/0190a8c72f8a/aperture-render-runtime-20261002
    python3 -B tools/recovery/runtime_pressure.py \
      --root /workspace/scratch/0190a8c72f8a/aperture-tmp \
      --audit-dir "$PWD/benchmarks/worker-shadow-light-matrix-20261003/lifecycle-audits-native" \
      run --job worker-shadow-directional-live \
      --recreation 'Run frozen worker shadow matrix via runVerifiedScene' -- \
      node benchmarks/worker-shadow-light-matrix-20261003/run.mjs directional live attempt-001

Inspect that attempt before admitting additional cases. The same runner supports
all modes and live/fresh-baseline/fresh-vertices/fresh-indices. Every case creates
its own new immutable attempt directory and new worker/device/canvas. Run the
CPU-only comparator under the adopted cleanup lifecycle after the four cases of
one mode or all 16 exist:

    python3 -B benchmarks/worker-shadow-light-matrix-20261003/compare.py attempt-001 comparison-001.json

Optional --mode directional checks the first complete mode. Output filename must
be new. A passing matrix closes only this bounded integration coverage extension.
Continuous RAF, source-assets-only sidebands, transferable fallback, mixed lights,
changing cameras, hardware GPUs, per-face pixel-occlusion attribution, throughput
and residency remain outside scope.
