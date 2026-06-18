# SAB Render Pacing Plan

**Status:** partially implemented, remaining work planned
**Date:** 2026-06-18
**Context:** racing frame pacing audit against the three.js starter-kit racing reference

## Summary

Aperture's render data model is already conceptually correct: the simulation
worker extracts a flat `RenderSnapshot`, and the renderer consumes that derived
view instead of querying ECS or a scene graph. The problem is the current browser
presentation policy. Even when the hot snapshot payload is written into
`SharedArrayBuffer`, `createWebGpuApp()` still schedules rendering from worker
snapshot messages. That means worker delivery jitter can influence presentation
cadence.

The target design is:

```text
worker ECS/fixed step -> extract snapshot -> publish latest complete shared frame
main requestAnimationFrame -> sample latest complete shared frame -> render
```

`postMessage` should remain for setup, wakeup, source-asset deltas, debug
summaries, audio sideband, registry updates, errors, and transferable fallback.
It should not be the frame clock in steady-state SAB mode.

## Current State

The first pacing slice is implemented and validated:

- `createWebGpuApp()` now keeps the browser-native RAF loop continuous instead
  of stopping when a RAF has no pending worker message.
- RAF reads the latest complete shared frame with the strict message-frame gate
  disabled. This lets an already-delivered sideband message decode a newer SAB
  frame when the registry has not changed.
- The generated worker still writes every supported render snapshot to SAB, but
  it now suppresses unchanged sideband `postMessage` traffic until a sideband
  heartbeat is due.
- Sideband messages remain immediate when the registry changes, source assets
  change, diagnostics appear, or a full worker summary is due.
- Browser-native RAF now starts render work directly from the RAF callback
  instead of inserting an extra resolved-Promise hop. This makes Aperture's
  presentation work visible to the browser frame callback in the same way as
  three.js/PlayCanvas-style render loops, while preserving the single-render
  in-flight guard.
- A regression test proves the key contract: frame 2 can be visible in SAB while
  the worker has still posted only the frame-1 sideband message.

Latest paired trace evidence after this slice:

- Short headed sanity trace, 2.5s samples:
  `/tmp/racing-paired-sab-plan-check/summary.json`
  - Aperture idle RAF p95 `18.06 ms`; three.js idle p95 `18.20 ms`.
  - Aperture drive RAF p95 `17.99 ms`; three.js drive p95 `18.01 ms`.
  - Aperture `renderStartHz` stayed at about `60 Hz`; `sharedUnavailable` was
    `0`; visual diagnostics were nonblank.
- Longer headed trace, 8s samples:
  - Aperture idle clearly led at p95/p99/max.
  - Aperture drive was effectively tied: p95 `18.655 ms` versus three.js
    `18.605 ms`, while Aperture was better at p99/max.
  - This is not yet a consistent win because the drive p95 delta is small and
    within run noise.
- RAF-direct traces, 8s samples:
  `/tmp/racing-paired-raf-direct-long-1/summary.json` and
  `/tmp/racing-paired-raf-direct-long-2/summary.json`
  - Run 1: Aperture drive won p95/p99/max (`18.13/18.49/18.65 ms`) versus
    three.js (`18.30/18.50/18.70 ms`).
  - Run 2: Aperture drive won max but trailed p95/p99
    (`18.22/18.45/18.61 ms`) versus three.js (`18.10/18.40/18.80 ms`).
  - Net: RAF-direct reduces the bad pre-change drive p99/max tail, but does not
    by itself prove consistent outperformance.
- Audio-sideband split traces, 8s samples:
  `/tmp/racing-paired-audio-sideband-long-1/summary.json` and
  `/tmp/racing-paired-audio-sideband-long-2/summary.json`
  - Run 1: Aperture idle won p95/p99/max (`16.68/17.23/17.66 ms`) versus
    three.js (`17.10/17.60/17.60 ms`) except a negligible `0.06 ms` max tie;
    Aperture drive won p95/p99/max (`17.19/17.50/17.64 ms`) versus three.js
    (`17.50/17.70/17.70 ms`).
  - Run 2: Aperture idle won p95/p99/max (`16.94/17.47/17.63 ms`) versus
    three.js (`17.30/17.60/17.70 ms`); Aperture drive won p95/p99/max
    (`17.26/17.67/17.67 ms`) versus three.js (`17.70/17.70/17.80 ms`).
  - Idle render-side snapshot messages dropped to about `29 Hz` while render
    stayed at `60 Hz` with `sharedUnavailable: 0`. Drive still reports about
    `62 Hz` render snapshot messages, so another drive-only sideband reason
    remains to identify.

Racing does author audio every frame. Therefore, simply lowering the generic
sideband heartbeat below `60 Hz` would either not affect this benchmark or would
risk stale audio state. The correct follow-up is to split render cadence from
audio/diagnostic sideband cadence, not to add a Racing-specific heartbeat hack.

## Confirmed Current Behavior

Source anchors:

- Worker snapshot publish is in `packages/app/src/worker/snapshot.ts`.
  `publishGeneratedWorkerSnapshot()` steps ECS, extracts a `RenderSnapshot`,
  writes shared frames when possible, and still posts a snapshot event.
- SAB frames are written in
  `packages/runtime/src/shared-snapshot-transport.ts`.
  The current writer uses a double-buffer plus a sequence counter: mark odd
  while writing, write inactive buffer, publish frame/count metadata, then mark
  even and notify.
- SAB frames are reconstructed in
  `packages/webgpu/src/app/app-snapshot-transport.ts`.
  `readWebGpuAppSharedSnapshot()` decodes packet words and attaches SAB-backed
  typed-array views to a normal `RenderSnapshot` shape.
- Presentation scheduling is in
  `packages/webgpu/src/app/create-webgpu-app.ts`.
  `onSnapshot()` stores one pending event and calls `scheduleAutoRender()`;
  the RAF callback renders only if a pending snapshot event exists.

So the current implementation is a hybrid:

```text
SAB carries most hot data, but worker messages still trigger rendering.
```

This coalesces bursts, but it is not a pure RAF pull loop. A RAF callback with
no pending worker message records "without snapshot" and stops.

## What Is Already In SAB

For supported shared frames, SAB currently carries:

- frame id in the atomic header;
- transforms;
- view matrices;
- optional instance tints;
- quad instance floats/words;
- packed packet words for views, mesh draws, shadow caster draws, lights,
  environments, fogs, particle emitters, shadow requests, bounds, and quad
  batches.

The logical `RenderSnapshot` still exists. SAB is the hot transport/encoding,
not a replacement for the renderer's data contract.

## What Still Uses postMessage

Even on the shared path, worker messages still carry:

- placeholder snapshot object for the existing simulation-worker protocol;
- packet registry snapshot for strings and asset handles;
- diagnostics;
- frame id;
- source asset deltas;
- worker timing/debug summaries;
- optional change-set sidebands;
- audio packets with copied transform slices.

The first pacing slice reduces unchanged shared-frame sideband messages, but
Racing still needs fresh audio sideband data. That keeps steady-state message
pressure relevant until audio has its own shared-memory sideband or a smaller
event/delta protocol.

Unsupported payload families currently force transferable fallback:

- sprites;
- UI nodes/hit regions;
- skyboxes;
- custom instance attribute packets/buffers;
- skinning buffers;
- morph buffers/descriptors.

## Why RAF Pull Is The Right Direction

The renderer should own presentation cadence because the browser compositor
owns display cadence. three.js and PlayCanvas both center normal presentation
around RAF. Bevy provides the more relevant architecture lesson for Aperture:
use an explicit extraction boundary and render derived data, but do not block
presentation on simulation ownership.

Borrow:

- Bevy: explicit extraction into render-facing data; stable render identity;
  previous/current frame separation.
- PlayCanvas and three.js: renderer-owned RAF loop and visibility-aware timing.

Do not borrow:

- a mutable scene graph as render state;
- same-thread update/render coupling;
- native-thread Bevy scheduling details that do not map to browser RAF.

Browser constraints also point this way:

- `SharedArrayBuffer` is shared memory, but synchronization must use Atomics.
- `Atomics.wait()` cannot be used on the main thread.
- `requestAnimationFrame()` is the correct main-thread presentation clock.
- Transferable fallback cannot be polled before a message arrives, because the
  buffer ownership transfer itself is delivered by the event loop.

External references:

- MDN `SharedArrayBuffer`:
  <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer>
- MDN `Atomics.wait()`:
  <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Atomics/wait>
- MDN `Atomics.waitAsync()`:
  <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Atomics/waitAsync>
- MDN `Window.requestAnimationFrame()`:
  <https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame>
- V8 `Atomics.wait`, `Atomics.notify`, `Atomics.waitAsync`:
  <https://v8.dev/features/atomics>

## Main Risk In The Current SAB Transport

The current double-buffer seqlock prevents torn reads at the instant
`readLatestFrame()` returns. It does not pin the returned typed-array views.
Those views alias the shared slot and can be overwritten two worker commits
later while the async render path still references them.

That is manageable only if the renderer copies/upload-consumes the shared data
before the writer can reuse the slot. The safer general fix is a small shared
ring with explicit slot ownership.

This is still the largest correctness issue in the SAB path. The current racing
trace improvements should not be treated as proof that double-buffer aliases are
safe under heavier scenes, slower GPU upload paths, or future worker rates above
display cadence.

## Target SAB Transport

Move from "latest double-buffer view" to "latest acquirable slot".

Use at least three slots. Per slot:

```text
FREE    = 0
WRITING = 1
READY   = 2
READING = 3
```

Control metadata:

- latest sequence;
- latest slot;
- per-slot sequence;
- per-slot frame id;
- per-slot state;
- per-slot stream lengths;
- registry epoch required by the slot.

Worker publish:

```text
1. Pick a FREE slot, or reclaim a stale READY slot that is not latest.
2. Mark WRITING.
3. Write snapshot streams and packet words.
4. Publish per-slot frame/counts/registryEpoch/sequence.
5. Mark READY.
6. Atomically publish latestSlot/latestSequence.
7. Optionally Atomics.notify() for non-render waiters.
```

Main RAF sample:

```text
1. RAF fires.
2. Load latestSequence/latestSlot.
3. If sequence equals last rendered sequence, skip render or keep last frame.
4. If the required registry epoch is not available, skip and count blocked.
5. CAS READY -> READING for the slot.
6. Decode/construct RenderSnapshot view.
7. Render or synchronously upload-copy any SAB-backed data needed by async GPU work.
8. Mark slot FREE after render no longer references it.
```

The first implementation can be conservative: copy the claimed slot's hot typed
arrays into renderer-owned scratch before releasing it. After that is correct,
optimize toward direct SAB-backed GPU uploads if WebGPU/browser behavior is
verified.

## Registry And Sideband Plan

Current packet decoding needs the string/handle registry sent in the worker
message. A pure RAF sampler must not depend on a specific message for a specific
frame.

Add a registry epoch:

- Worker increments the epoch when the packet registry grows.
- SAB slot records the epoch it was encoded against.
- Messages carry registry deltas or full registry snapshots tagged by epoch.
- Main stores the latest registry by epoch.
- RAF can decode a slot only when the required epoch is available.

Initial slice may keep sending full registry snapshots per shared message, but
it must store them by epoch and remove the current expected-frame gate. A later
slice should replace full registry snapshots with deltas or a shared append-only
registry table.

Audio sideband needs the same treatment:

- Short term: keep audio sideband messages at display cadence when a snapshot
  carries audio packets, while render sampling is allowed to reuse sideband and
  read newer SAB frames.
- Medium term: move audio listener/emitter packets into a compact shared-memory
  sideband with its own sequence number, or send audio deltas/events separately
  from render-frame sideband.
- Do not use a lower sideband heartbeat for audio-heavy apps unless audio has a
  separate freshness guarantee.

## Main-Thread Presentation Plan

In `create-webgpu-app.ts`, split render scheduling by transport mode.

SAB mode:

- Start a continuous presentation loop on `app.start()`.
- On every RAF, attempt to acquire and render the latest shared frame.
- Keep `onSnapshot()` only for sideband and for waking/starting the loop.
- Render at most one frame at a time.
- If a render is in flight, mark the RAF as missed and let the next RAF sample
  the latest complete frame instead of draining every worker message.
- Track repeated frames, skipped worker frames, stale reads, registry-blocked
  reads, and snapshot age.

Transferable mode:

- Keep worker `postMessage` as the only way new snapshots arrive.
- Store only the latest received transferable snapshot.
- Run the same RAF presentation loop, but sample from the latest received
  snapshot rather than SAB.
- Drop stale pending snapshots. Do not render once per message.
- Add an optional transferred-buffer pool later so the main thread can return
  buffers to the worker instead of allocating/churning.

This gives both modes the same presentation policy:

```text
RAF owns display cadence.
Transport only updates the latest available simulation snapshot.
```

## Smoothing Plan

Render pacing alone will not fix all perceived smoothness. The presentation
loop should expose enough data for snapshot interpolation and pose freshness.

Add per-render metrics:

- RAF timestamp;
- rendered snapshot frame;
- shared sequence;
- worker publish timestamp when available;
- snapshot age at render start;
- repeated RAF count;
- skipped shared-frame count;
- render-in-flight misses;
- interpolation alpha used;
- vehicle/camera pose delta in racing diagnostics.

Then tune:

- snapshot interpolation alpha from RAF timestamp and fixed-step sample times;
- camera interpolation coverage;
- behavior when no new snapshot is ready: hold, extrapolate limited camera-only
  pose, or render latest with alpha clamp.

## Transferable Fallback Improvements

Transferable fallback cannot become true polling because the main thread cannot
see a transferred buffer until the message task runs. It can still improve
pacing:

- Message handler should only update `latestTransferableSnapshot`.
- RAF loop decides when to render it.
- Older pending transferable snapshots are dropped before render.
- Add sequence/frame counters so stale messages cannot replace newer snapshots.
- Later, add a transferable buffer pool:
  worker owns free buffers, writes into one, transfers it, main returns buffers
  after render/upload consumption.

## Validation Plan

Unit tests:

- shared transport acquires/releases slots without torn reads;
- writer does not overwrite READING slots;
- reader skips slots whose registry epoch is unavailable;
- RAF loop renders monotonic sequence ids and drops stale frames;
- transferable mode stores latest snapshot and renders from RAF rather than
  message count;
- fallback remains correct for unsupported SAB payload families.

Browser tests:

- SAB enabled under cross-origin isolation;
- fallback path when SAB is unavailable;
- stress worker at 240-1000 Hz while RAF renders at display cadence;
- main-thread stall test proving no partially written slot renders;
- WebGPU `queue.writeBuffer()` from SAB-backed views, with scratch-copy fallback
  if needed.

Racing benchmark checks:

- compare Aperture vs three.js idle and drive RAF p50/p95/p99/max;
- report snapshot age p50/p95/p99;
- report repeated/skipped snapshot counts;
- report render-in-flight misses;
- report draw calls and render phase timing to ensure batching gains stay.

## Implementation Sequence

1. **Done: instrumentation first.**
   Cadence diagnostics and the racing trace script now report RAF/render start
   cadence, pending replacement, skipped shared-frame gaps, queue age, visual
   nonblank checks, and summary comparisons.

2. **Done: SAB latest-frame reader without expected-message frame gate.**
   `readWebGpuAppSharedSnapshot(..., { requireMessageFrame: false })` lets RAF
   sample the latest complete shared frame while keeping strict reads available
   for protocol tests.

3. **Done: browser-native RAF keeps running and starts render directly.**
   Native presentation mode no longer depends on receiving a worker message for
   every render callback. It can reuse the latest shared sideband and render a
   newer SAB frame. Render work now starts from the RAF callback instead of a
   follow-up microtask.

4. **Done: throttle unchanged shared sideband messages.**
   The worker still writes every shared frame, but it posts unchanged sideband
   messages only on the heartbeat or when registry/assets/diagnostics/full
   summaries require it.

5. **Done: separate render sideband from audio sideband.**
   Racing carries audio packets, so display-rate sideband messages are still
   justified for audio freshness. Audio now has an audio-only worker message
   path, so render registry/diagnostic sideband can run at a lower heartbeat
   while audio keeps display-rate updates.

6. **Next: identify remaining drive-side render sideband reason.**
   Drive still receives render snapshot messages around display cadence even
   after audio splitting. Add reason counters for registry/source-asset/full
   summary/diagnostic/heartbeat sideband posts, then remove avoidable drive
   churn.

7. **Next: slot ownership / triple buffering.**
   Replace double-buffer seqlock views with an acquirable ring, or add a
   conservative copy-on-acquire layer as an interim correctness step.

8. **Next: registry epoch sideband.**
   Tag slots and registry payloads by epoch. Decode only when the matching
   registry is available. Then reduce per-message registry clone cost with
   deltas.

9. **Next: transferable latest-snapshot queue.**
   Make transferable fallback follow the same RAF sampling policy, dropping
   stale messages before render.

10. **Next: smoothing and interpolation pass.**
   Use the new pose-cadence diagnostics to tune interpolation alpha and camera
   smoothness in racing without changing the ECS authority boundary.

## Non-Goals

- Do not make the renderer query ECS directly.
- Do not introduce a mutable scene graph.
- Do not move WebGPU presentation into the simulation worker in this slice.
- Do not block the main thread with `Atomics.wait()`.
- Do not require one render per worker publish.

## Expected Outcome

This should improve perceived smoothness by decoupling presentation cadence from
worker-message cadence. It also makes the racing comparison fairer: three.js
renders from RAF, and Aperture should also present from RAF while still keeping
the ECS worker and render extraction boundary.

The draw-call and batching work remains valuable, but this plan targets the
remaining "three.js feels smoother" gap: pose freshness, snapshot age, and
display-cadence consistency.
