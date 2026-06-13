# Aperture Audio Subsystem — Definitive Implementation Plan

**Status:** plan
**Date:** 2026-06-13

## 1. Title & Executive Summary

**Aperture Audio: A Worker-Authored, Main-Thread-Realized Spatial Audio Subsystem**

Aperture's audio is a _derived view_ of an authoritative ECS simulation, built as the exact structural sibling of the existing GPU particle/effects pipeline. The ECS World in the Web Worker owns only _intent_ — which clip should play, at what gain, on which bus, with what spatial falloff, and when (monotonic `playEpoch`/`stopEpoch` triggers) — and the emitter/listener world transforms ride the same `transforms` Float32Array the renderer already packs each frame. A new main-thread package, `@aperture-engine/audio`, is the audio analog of `@aperture-engine/webgpu`: it consumes `AudioEmitterPacket[]` and a single `AudioListenerPacket` from the per-frame `RenderSnapshot`, reconciles them by stable voice key into a _pooled voice graph_, and realizes them against a real Web Audio bus mixer (master → DynamicsCompressor limiter → destination, with `music/sfx/ui/ambient/voice` submix buses).

This design adds the entire management layer three.js lacks — a pooled voice subgraph, distance/loudness/priority _virtualization_ and _voice stealing_, named submix buses with click-free scripted ducking, automatic decode-once-by-handle `AudioBuffer` caching, auto-Doppler from velocity, and a full autoplay/unlock/suspend lifecycle. It deliberately matches three.js (using the same proven technique) on the AudioParam ramp convention, the forward/up basis, `slice(0)`-before-decode, buffer sharing, `setPlaybackRate`/`setDetune`, arbitrary filters, `offset/duration/loopStart/loopEnd`, and FFT analysis — see the audited parity table in §8. The worker never touches a Web Audio node; the main thread never touches gameplay state; the seam between them is one snapshot per tick.

---

## 2. Philosophy & Alignment

Aperture's defining law is **"simulation is authoritative and rendering is a derived view."** Audio is not an exception — it is the _second instance_ of it. Two facts make audio fit the existing seam rather than fight it:

1. **Web Audio is physically main-thread-only.** `AudioContext`, `PannerNode`, `AudioListener`, `GainNode`, and `AudioWorklet` cannot exist in a Web Worker. (`AudioWorklet` runs on its own audio render thread but is _created_ from the main thread.) So the worker _physically cannot_ own audio nodes — exactly the constraint that already forces rendering onto the main thread.

2. **Particles are the philosophical anchor.** `ParticleEmitter` (`packages/render/src/rendering/authoring-components-core.ts:92`) stores _only_ intent, with the doc-string: _"ECS owns playback intent, seeds, reset epochs, bounds, and effect handles; live particle buffers remain WebGPU-owned."_ Audio's doc-string is that sentence with **"live AudioBufferSourceNodes/PannerNodes remain Web-Audio-owned on the main thread."**

### The effect/particle parallel: one-shot vs loop

Audio and particles are both _effects_, expressing the loop-vs-burst distinction through the same asset/component split. The **asset** owns the playback _shape_ (loop, duration, loopStart/loopEnd, default window); the **component** owns per-instance _control_ (epoch, seed, time scale, gain, offset). A `playEpoch` bump is the one-shot trigger — the audio analog of a particle `resetEpoch` restart.

### AudioEmitter ↔ ParticleEmitter field map

| AudioEmitter field                            | ParticleEmitter field        | Meaning / Web Audio realization                                                            |
| --------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------ |
| `clipId` (String)                             | `effectId` (String)          | `assetHandleKey(handle)` of the audio asset                                                |
| `playEpoch` (Int32)                           | `resetEpoch` (Int32)         | Monotonic trigger **counter**; main fires signed-delta `(playEpoch − lastRealized)` voices |
| `stopEpoch` (Int32)                           | _(no analog)_                | Monotonic stop **counter**; click-free fade-stop of sustained voices                       |
| `seed` (Int32)                                | `seed` (Int32)               | Deterministic variation index (pitch/gain; clip-pick when a bank exists)                   |
| `timeScale` (Float32)                         | `timeScale` (Float32)        | `AudioBufferSourceNode.playbackRate` (authored; composes with Doppler — §7)                |
| `simulationSpace` (Enum)                      | `simulationSpace` (Enum)     | `world` = spatial (PannerNode); `local` = 2D/UI non-spatial                                |
| `boundsCenter` (Vec3)                         | `boundsCenter` (Vec3)        | Audibility/virtualization center                                                           |
| `audibilityRadius` (Float32)                  | `boundsRadius` (Float32)     | Virtualization promote/demote radius                                                       |
| `active` (Boolean)                            | `visible` (Boolean)          | Extraction state — see mute semantics (§5/§12), not a hard cull                            |
| `gain` (Float32)                              | _(asset color/speed ranges)_ | Per-instance linear gain                                                                   |
| `offsetSec`, `loopStart`, `loopEnd` (Float32) | _(asset duration/bursts)_    | Playback-window authoring (parity with three.js)                                           |
| `busId` (String)                              | _(no analog — mixing seam)_  | Submix routing string handle key                                                           |
| `maxDistance/refDistance/rolloff`             | _(no analog — spatial seam)_ | `PannerNode` falloff params                                                                |
| `coneInner/Outer/OuterGain`                   | _(no analog)_                | `PannerNode` directional cone                                                              |
| `priority` (Int32)                            | _(no analog — voice seam)_   | Voice-stealing rank                                                                        |

The one **deliberate divergence**: particles are _frustum-culled_ (`isVisibleInAnyMatchingView`, `extraction-particles.ts:150-158`); audio must **not** be — off-screen and behind-you sounds must still play. Audio gates on _listener audibility_ instead. Critically, that gate is a **soft demote (still-emitted "inaudible" packet), never a hard worker drop**, so virtual loops keep a packet to refresh their playhead and re-promote correctly on re-approach (resolved tension — see §7 and §12).

---

## 3. Architecture Overview

```
┌──────────────────────────────── WEB WORKER (authoritative simulation) ─────────────────────────────────┐
│   ECS World (elics)                                                                                       │
│     ├─ AudioEmitter (intent only: clipId, gain, loop, playEpoch, stopEpoch, busId, falloff, priority …)   │
│     ├─ AudioListener (marker; pose from WorldTransform, falls back to active Camera)                      │
│     └─ AudioClip asset entry  ── AssetRegistry (kind "audio-clip": ENCODED bytes + metadata, NO buffer)   │
│                                                                                                          │
│   advanced.ts step():  resolveWorldTransforms() ─► flushApertureSystemEffects('input') / step('update')   │
│                         │                              / flushApertureSystemEffects('postUpdate')          │
│                         │            effects.watch(signal)/onQueryEnter(query) bump playEpoch (DETERMINISTIC)│
│                         ▼                                                                                   │
│   systems/audio.ts (worker):  drains "aperture.audio.*" command channel; mints transient emitters;        │
│                               models deterministic completion timers from durationHint + authored timeScale│
│                         ▼                                                                                   │
│   extract(frame):                                                                                          │
│     extractAudioEmitters(world, assets, transforms, listenerWorld, diags)                                 │
│       • query {required:[AudioEmitter]}, sortedEntities, Enabled/WorldTransform gates                     │
│       • status==='ready' && asset!==null  ─► stamp clipVersion                                            │
│       • pushMatrix(transforms, worldMatrix) ─► worldTransformOffset   (packed buffer)                     │
│       • audibility tag (|pos−listener| vs maxDistance): inaudible=soft demote, NOT a drop — NO frustum cull│
│     extractAudioListener(...) ─► AudioListenerPacket (WORLD matrix pose pushed; not the inverted view)    │
│                         ▼                                                                                   │
│   RenderSnapshot { views, meshDraws, particleEmitters, audioEmitters?, audioListener?, frame, transforms } │
│   workerSummary { signals (bus/master gains, pause flags), commands.summary() } ── posted WORKER→MAIN      │
│                         │                                                                                   │
│   publishGeneratedWorkerSnapshot():                                                                        │
│     hasUnsupportedSharedSnapshotPayload(audioEmitters) ─► force TRANSFERABLE path (same as particles)     │
└─────────────────────────────────────────────┬────────────────────────────────────────────────────────────┘
                                               │  postMessage(snapshot, renderSnapshotTransferList) ── transfer
                                               ▼
┌──────────────────────────────── MAIN THREAD (derived views) ──────────────────────────────────────────────┐
│   onSnapshot(decodedSnapshot):   // post-readWebGpuAppSharedSnapshot; coalesced to NEWEST per rAF           │
│     renderer consumes it (existing WebGPU path)                                                            │
│     audioEngine.applySnapshot(snapshot, frameDeltaMeasured)   ◄── @aperture-engine/audio (NEW)             │
│                                                                                                            │
│   AudioEngine                                                                                               │
│     • ClipCache: decodeAudioData ONCE keyed by (clipId, clipVersion); bounded concurrent decode queue      │
│     • VoiceManager: audibility score (incl. cone), top-N real vs node-less virtual, steal weakest          │
│     • VoicePool: [PannerNode + occlusion BiquadFilter + per-voice GainNode] reused; source node throwaway  │
│     • Listener: positionX/Y/Z + forwardX/Y/Z + upX/Y/Z via linearRampToValueAtTime (NEVER setOrientation)  │
│     • Mixer: buses + master + DynamicsCompressor + per-bus AnalyserNode taps (FFT)                         │
│     • Lifecycle: resume-on-gesture, suspend-on-visibilitychange, game-pause, Safari 'interrupted', iOS unlock│
│     • Diagnostics summary: active/virtual/steals/dropped/per-bus level                                     │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

The parallel to rendering is exact: `extractAudioEmitters` ≈ `extractParticleEmitters`; `AudioEmitterPacket` ≈ `ParticleEmitterPacket`; `AudioEngine.applySnapshot` ≈ the renderer's snapshot consumer; `VoicePool` ≈ the GPU particle buffer pool. Audio rides the _same snapshot, same transforms buffer, same transferable transport_ — a moving emitter's sound never lags its sprite because both consume the same frame's transforms.

---

## 4. The Worker ↔ Main Boundary

### Snapshot extension (no parallel channel)

Audio extends the existing `RenderSnapshot` rather than running a second transferable channel. Per-frame emitter and listener world matrices ride the _same_ packed `transforms` Float32Array via `worldTransformOffset`. **Precise transport semantics:** on the transferable path that `ArrayBuffer` is _transferred_ (detached from the worker) via `renderSnapshotTransferList`; on the SAB path it is a subarray view into a SharedArrayBuffer. It is "zero-copy" in the transfer/view sense — _not_ a persistently shared buffer the main thread can read across frames. Cross-frame reads (Doppler finite-difference, §7/AU-14) therefore require the engine to **copy out each frame's emitter positions into its own retained array** before the buffer is reused/detached. A parallel channel would duplicate transforms or reintroduce per-packet `vec3` allocation (both anti-patterns) and risk audio/render transform skew.

```ts
// snapshot-core-types.ts — RenderSnapshot additions (spread-omitted when empty)
interface RenderSnapshot {
  // ...existing fields (frame, views, meshDraws, spriteDraws, particleEmitters, transforms, ...)...
  readonly audioEmitters?: readonly AudioEmitterPacket[];
  readonly audioListener?: AudioListenerPacket; // single active listener (Bevy: first wins; see §12 split-screen note)
}
```

```ts
// snapshot-packet-types.ts — clone of ParticleEmitterPacket (re-exported via rendering/index.js)
export type AudioSimulationSpacePacket = "world" | "local"; // "local" => 2D/non-spatial
export type AudioVoiceKey = // disjoint id space — emitterId is NOT a bare number
  | { readonly kind: "entity"; readonly id: number } // createStableRenderId(entityRef)
  | { readonly kind: "oneshot"; readonly seq: number }; // monotonic worker-local sequence

export interface AudioEmitterPacket {
  readonly key: AudioVoiceKey; // voice reconciliation key (structurally collision-free)
  readonly entity: RenderEntityRef;
  readonly clip: AudioClipHandle;
  readonly clipVersion: number; // bump => main re-decodes
  readonly busId: string;
  readonly gain: number;
  readonly loop: boolean;
  readonly playEpoch: number; // monotonic trigger COUNTER; main fires signed-delta voices
  readonly stopEpoch: number; // monotonic stop COUNTER; click-free fade-stop
  readonly timeScale: number; // authored playbackRate (Doppler composes multiplicatively, main-side)
  readonly priority: number;
  readonly panningModel: "equalpower" | "HRTF";
  readonly simulationSpace: AudioSimulationSpacePacket;
  readonly distanceModel: "inverse" | "linear" | "exponential";
  readonly refDistance: number;
  readonly maxDistance: number;
  readonly rolloffFactor: number;
  readonly coneInnerAngle: number;
  readonly coneOuterAngle: number;
  readonly coneOuterGain: number;
  readonly offsetSec: number;
  readonly loopStart: number;
  readonly loopEnd: number; // playback window (three.js parity)
  readonly audibility: "audible" | "inaudible"; // soft demote flag; inaudible still ships to retain virtual playhead
  readonly muted: boolean; // per-emitter mute = gain-to-zero, playhead continues (NOT a drop)
  readonly worldTransformOffset: number; // index into snapshot.transforms; this is the WORLD matrix (not inverted view)
  readonly layerMask: number;
}

export interface AudioListenerPacket {
  readonly listenerId: number;
  readonly entity: RenderEntityRef;
  readonly worldTransformOffset: number; // WORLD matrix: pos = col3, forward = -col2, up = +col1 (rigid; see §12)
  readonly masterGain: number;
}
```

```ts
// worker/snapshot.ts — add to the existing SAB-fallback guard (exactly where particleEmitters already lives, :206)
function hasUnsupportedSharedSnapshotPayload(
  snapshot: RenderSnapshot,
): boolean {
  return (
    /* ...existing: spriteDraws, particleEmitters, uiNodes, uiHitRegions, skyboxes, fogs,
       instanceAttributePackets, bones, morphTargetWeights/Deltas, morphInstanceDescriptors, instanceAttributes... */
    hasItems(snapshot.audioEmitters) || snapshot.audioListener !== undefined
  );
}
```

**Why this is genuinely the same mechanism particles use (verified):** the SAB packed codec (`snapshot-packed-encoder.ts`) only encodes views/meshDraws/lights/environments/shadowRequests/bounds/quadBatches — it cannot encode particle, sprite, UI, or audio packets. `particleEmitters` is already listed in `hasUnsupportedSharedSnapshotPayload` (`worker/snapshot.ts:206`), so any frame carrying particles already forces the transferable path. Audio does the identical thing. **Scope correction:** this is not "audio kills SAB" — _any_ frame already carrying sprites/particles/UI/fog/skybox is on transferable too, so audio only forfeits SAB for otherwise-SAB-eligible (pure mesh+light+env) scenes. A scene with no audio pays _nothing_ (fields spread-omitted). AU-2 still ships with an explicit transport-fallback test (no dropped packets on a cross-origin-isolated page).

### Discrete intents: the `playEpoch` counter

There is no event ring at this seam. Audio reuses the particle `resetEpoch` primitive. Each `AudioEmitter` carries a monotonic `playEpoch` (Int32) bumped inside an `effects.ts` callback. The packet carries the current `playEpoch` every frame; the engine keeps `lastRealizedEpoch` per voice key and fires `(packet.playEpoch − lastRealizedEpoch)` voices (capped by budget). As a **counter, not a boolean**, a single Int32 carries both _"play now"_ and _"how many"_ — covering N rapid one-shots in a single fixed step (e.g. an 8-hit burst). A `stopEpoch` counter symmetrically requests a click-free fade-stop of sustained/long voices.

This beats an event ring for this seam:

- **Idempotent** under coalesced/dropped frames — only the signed delta matters (see coalescing below).
- **No new transport** — no SAB ring, no Atomics, no cross-origin-isolation requirement.
- **Degrades correctly across suspension** — a stale one-shot epoch is _dropped_ on resume; a loop whose epoch is newer than `lastRealized` starts _mid-loop_.

**Signed-delta + wrap + aliasing.** `playEpoch`/`stopEpoch` are compared via **signed 32-bit wrapping delta**. The voice key is a tagged union (`{kind,id}`), not a bare number, so the entity/one-shot id spaces are **structurally disjoint** — fixing the impossible "namespaced subrange of a saturated 32-bit key" in the draft. `createStableRenderId` consumes the full 32 bits (`(generation & 0xff) << 24 | index & 0xffffff`), and with only 8 generation bits an entity index can alias a prior entity after 256 reuses. The reconciliation map therefore (a) keys on `AudioVoiceKey`, (b) also stores the clip handle, and (c) treats **absence-then-reappearance** (the per-frame seen-sweep below) as a fresh logical emitter: on reappearance `lastRealized` is re-seeded to the packet's current `playEpoch`, so a reused id cannot back-fire or mis-count.

### Coalescing contract (realtime)

The worker publishes one snapshot per `setTimeout`-driven tick (`loop.ts`), which is **not** synced to main-thread rAF and can run faster (nested timers floor at ~4 ms). `applySnapshot` is driven from the renderer's snapshot consumer (rAF-paced). Contract:

- The engine processes **only the newest snapshot per rAF** and discards intermediate ones.
- This is safe for `playEpoch`/`stopEpoch` because they are **counters** — a dropped intermediate snapshot still carries the cumulative count, so no trigger is lost.
- This is the reason entity-less one-shots are modeled as **counter-carrying transient emitter packets that persist across frames** (until consumed) rather than as fire-once command events that a dropped frame would lose. (See `playOneShot`, §5.)

### Ramp time base (realtime — promoted from open question)

`RenderSnapshot` carries an integer `frame` and **no delta/time**. The only `frameDelta` in the codebase is worker-side (`fixed-step-schedule.ts:18`) and is never serialized. **Decision:** ramp endpoints are **main-thread-frame-derived, not sim-derived**. `applySnapshot(snapshot, frameDelta)` receives a `frameDelta` measured by the engine as the wall-clock interval between consecutive `applySnapshot` calls (rAF delta), **clamped** to `[minRampSec, maxRampSec]` (e.g. `[8 ms, 50 ms]`) so a stall or a burst of coalesced snapshots cannot produce an over/undershooting ramp endpoint. All `linearRampToValueAtTime(value, ctx.currentTime + frameDelta)` calls use this clamped value. This is documented as the contract: _the ramp endpoint tracks main-thread frame cadence, never sim time._

### Latency story for one-shots

`watch()`/`onQueryEnter()` bump `playEpoch` during the worker's fixed-step `step()`. The next `publishGeneratedWorkerSnapshot()` carries the new epoch; `applySnapshot` schedules `source.start(ctx.currentTime + ε, offset)` against the AudioContext wall clock. **Worst-case perceived latency** = one worker publish interval + main-thread coalescing/rAF latency + the master `DynamicsCompressorNode` lookahead (~6 ms, on every routed voice) + platform output latency (`baseLatency`/`outputLatency`, **platform-dependent, tens of ms**; not asserted as fixed per-OS numbers). The seam itself adds _one frame_; the limiter lookahead and output latency are additive and are surfaced via `AudioContext.outputLatency` so rhythm-sensitive content can compensate (§12 latency-compensation).

### The determinism seam

- ECS component = authoritative for **INTENT** ("N triggers requested / wants to loop / stop requested").
- AudioEngine = authoritative for **REALIZATION** ("this voice is sounding at `ctx.currentTime`").
- Realization state is **never written back into the deterministic worker sim**. Mirrors Bevy's `(AudioPlayer, PlaybackSettings)` = intent / `AudioSink` = realization, adapted to our boundary — our "sink" lives on main keyed by `AudioVoiceKey` and is never echoed into the ECS (the worker has no main-thread handle).
- **"Did this sound finish?"** is modeled as deterministic sim state: a completion timer computed from `durationHint` and the **authored** `timeScale` only — **never** from the main-side realized rate (Doppler/runtime playbackRate changes must not feed the sim timer, or determinism breaks).
- The **fixed-step sim clock never schedules audio.** Sim time only _orders_ intents; wall-clock owns _playback_. Recorded-replay reproduces identical `playEpoch`/`stopEpoch`/`seed` integer sequences but **not** sample-accurate onset. Tests assert epoch/voice state, never waveform timing (mirroring the memory note that morph/skin tests assert STEP state, not pixels). Voice stealing is main-side and non-deterministic under contention — audible output is _not_ a determinism oracle.
- **Inv-6 (new):** the main-thread AudioEngine **never mutates the worker signal store.** Authored bus/master gains and pause flags flow worker→main via `workerSummary.signals`; ducking sidechain, crossfade, and steal-fade are _main-side realization_ and never echo back, or that state would silently escape the deterministic record/replay stream.

---

## 5. ECS Components & Authoring API

### Components (worker, intent-only)

```ts
// render/src/rendering/authoring-components-core.ts — sibling of ParticleEmitter (line 92)
export const AudioEmitter = defineComponent(
  "aperture.render.audioEmitter",
  {
    clipId: { type: EcsType.String, default: "" }, // assetHandleKey("audio-clip:id")
    busId: { type: EcsType.String, default: "sfx" }, // music|sfx|ui|ambient|voice
    gain: { type: EcsType.Float32, default: 1 },
    timeScale: { type: EcsType.Float32, default: 1 }, // authored playbackRate
    loop: { type: EcsType.Boolean, default: false },
    autoplay: { type: EcsType.Boolean, default: false },
    playEpoch: { type: EcsType.Int32, default: 0 }, // monotonic trigger COUNTER
    stopEpoch: { type: EcsType.Int32, default: 0 }, // monotonic stop COUNTER
    seed: { type: EcsType.Int32, default: 1 }, // deterministic variation index
    priority: { type: EcsType.Int32, default: 0 }, // voice-stealing rank (higher = protected)
    muted: { type: EcsType.Boolean, default: false }, // gain-to-zero, playhead continues
    offsetSec: { type: EcsType.Float32, default: 0 }, // start offset (three.js parity)
    loopStart: { type: EcsType.Float32, default: 0 }, // loop window (three.js parity)
    loopEnd: { type: EcsType.Float32, default: 0 }, // 0 => clip end
    simulationSpace: {
      type: EcsType.Enum,
      enum: AudioSimulationSpace,
      default: AudioSimulationSpace.World,
    },
    panningModel: {
      type: EcsType.Enum,
      enum: AudioPanningModel,
      default: AudioPanningModel.EqualPower,
    },
    distanceModel: {
      type: EcsType.Enum,
      enum: AudioDistanceModel,
      default: AudioDistanceModel.Inverse,
    },
    refDistance: { type: EcsType.Float32, default: 1 },
    maxDistance: { type: EcsType.Float32, default: 10000 },
    rolloffFactor: { type: EcsType.Float32, default: 1 },
    coneInnerAngle: { type: EcsType.Float32, default: 360 },
    coneOuterAngle: { type: EcsType.Float32, default: 360 },
    coneOuterGain: { type: EcsType.Float32, default: 0 },
    boundsCenter: { type: EcsType.Vec3, default: [0, 0, 0] },
    audibilityRadius: { type: EcsType.Float32, default: 1 },
    active: { type: EcsType.Boolean, default: true }, // false => stop & free (NOT mute; see §12)
  },
  "Renderer-independent audio emitter authoring. ECS owns playback intent, epochs, seeds, gain, bus routing, " +
    "and clip handles; live AudioBufferSourceNodes/PannerNodes remain Web-Audio-owned on the main thread.",
);

export const AudioListener = defineComponent(
  "aperture.render.audioListener",
  {
    active: { type: EcsType.Boolean, default: true }, // exactly one active honored; others diagnosed
    masterGain: { type: EcsType.Float32, default: 1 },
  },
  "Marks the entity (usually the Camera) whose WORLD transform drives the Web Audio AudioListener pose. " +
    "Pose comes from the WORLD matrix basis (not the inverted view matrix). NO AudioContext.listener node lives here.",
);
```

**`active` vs `muted` (resolved ambiguity from critique 4).** `active:false` is a _stop-and-free_ intent — the packet still ships for one frame carrying a `stopEpoch`-equivalent teardown so the engine fades and frees the voice click-free, then the emitter goes silent and `lastRealized` resets on reappearance. `muted:true` is _gain-to-zero with the playhead still advancing_ (loops resume in phase on unmute); the packet keeps shipping. Per-emitter mute = component `muted`; per-bus and master mute = mixer-side (§7) gain-to-zero. Mute never stops the voice and never desyncs `lastRealized`.

### Authoring helpers (clone of `createParticleEmitter`, `authoring-create-particles.ts:11`; lives in a new `authoring-create-audio.ts`)

```ts
export interface AudioEmitterInput {
  readonly clip: AudioClipHandle;
  readonly busId?: string;
  readonly gain?: number;
  readonly timeScale?: number;
  readonly loop?: boolean;
  readonly autoplay?: boolean;
  readonly muted?: boolean;
  readonly playEpoch?: number;
  readonly stopEpoch?: number;
  readonly seed?: number;
  readonly priority?: number;
  readonly offsetSec?: number;
  readonly loopStart?: number;
  readonly loopEnd?: number;
  readonly simulationSpace?: AudioSimulationSpace;
  readonly panningModel?: AudioPanningModel;
  readonly distanceModel?: AudioDistanceModel;
  readonly refDistance?: number;
  readonly maxDistance?: number;
  readonly rolloffFactor?: number;
  readonly coneInnerAngle?: number;
  readonly coneOuterAngle?: number;
  readonly coneOuterGain?: number;
  readonly boundsCenter?: Vec3Like;
  readonly audibilityRadius?: number;
  readonly active?: boolean;
}

export function createAudioEmitter(
  input: AudioEmitterInput,
): ComponentInitialData<typeof AudioEmitter> {
  return {
    clipId: assetHandleKey(input.clip), // exactly authoring-create-particles.ts:15
    busId: input.busId ?? "sfx",
    gain: input.gain ?? 1,
    timeScale: input.timeScale ?? 1,
    loop: input.loop ?? false,
    autoplay: input.autoplay ?? false,
    muted: input.muted ?? false,
    playEpoch: input.playEpoch ?? 0,
    stopEpoch: input.stopEpoch ?? 0,
    seed: input.seed ?? 1,
    priority: input.priority ?? 0,
    offsetSec: input.offsetSec ?? 0,
    loopStart: input.loopStart ?? 0,
    loopEnd: input.loopEnd ?? 0,
    simulationSpace: input.simulationSpace ?? AudioSimulationSpace.World,
    panningModel: input.panningModel ?? AudioPanningModel.EqualPower,
    distanceModel: input.distanceModel ?? AudioDistanceModel.Inverse,
    refDistance: input.refDistance ?? 1,
    maxDistance: input.maxDistance ?? 10000,
    rolloffFactor: input.rolloffFactor ?? 1,
    coneInnerAngle: input.coneInnerAngle ?? 360,
    coneOuterAngle: input.coneOuterAngle ?? 360,
    coneOuterGain: input.coneOuterGain ?? 0,
    boundsCenter: [
      input.boundsCenter?.[0] ?? 0,
      input.boundsCenter?.[1] ?? 0,
      input.boundsCenter?.[2] ?? 0,
    ],
    audibilityRadius: input.audibilityRadius ?? 1,
    active: input.active ?? true,
  };
}

export function createAudioListener(
  input: { active?: boolean; masterGain?: number } = {},
) {
  return { active: input.active ?? true, masterGain: input.masterGain ?? 1 };
}
// validateAudioEmitterInput clones validateParticleEmitterInput (authoring-validation-effects.ts:143) with audio.* codes.
```

### `playOneShot` — fire-and-forget without an entity (corrected data flow)

The draft claimed main-thread `playOneShot` "drains in `extractAudioEmitters`." **That is backwards** and is fixed here. The command queue lives in the _worker's_ ECS context (`worker/commands.ts:19`); `commands.summary()` flows _worker→main_ (`worker/snapshot.ts:105`). There is also **no existing `.drain()` usage** in production code — so the drain seam is **new scope**, owned by AU-1.5. Two correct shapes; the plan adopts (A):

- **(A) Worker-authoring one-shot (chosen for v1).** Author code (a system) enqueues `PlayOneShotCommand` into the _worker_ command channel; the worker `systems/audio.ts` drains it during `step()`, mints a **transient emitter** with a `{kind:"oneshot", seq}` key, `playEpoch:1`, and pushes its matrix into `transforms`. The next snapshot carries it as a normal `AudioEmitterPacket` that **persists until the engine confirms realization** (counter-based, so coalesced frames don't drop it). This accepts one extra worker round-trip in exchange for staying entirely inside the deterministic snapshot model. The drain pattern, a **bounded per-frame drain cap**, and a **queue backpressure/drop policy** (see §12) are established as AU-1.5.
- **(B) Pure main-side one-shot (deferred).** Handle entity-less SFX entirely inside `@aperture-engine/audio`, outside the snapshot model. Lower latency, but it bypasses the record/replay stream. Deferred (see Deferred / Non-goals).

```ts
export interface PlayOneShotCommand {
  // worker channel "aperture.audio.oneShot"
  readonly clipId: string;
  readonly busId?: string;
  readonly gain?: number;
  readonly timeScale?: number;
  readonly seed?: number;
  readonly worldPos?: Vec3Like; // worker pushes into transforms when minting the transient emitter
}
```

### Reactive triggers

```ts
// (1) Persistent-entity trigger (footstep) — bump playEpoch on state change, postUpdate (after physics writeback):
this.effects.watch(
  grounded,
  (isDown) => {
    if (isDown) bumpPlayEpoch(entity, AudioEmitter);
  },
  { phase: "postUpdate" },
);

// (2) Play-on-enter (explosion), no long-lived audio entity — worker-authoring one-shot:
this.effects.onQueryEnter(
  this.queries.exploded,
  (entity) => {
    this.commands.queue<PlayOneShotCommand>("aperture.audio.oneShot", {
      clipId: BOOM,
      worldPos: readWorldPos(entity),
    });
  },
  { phase: "postUpdate" },
);
```

`watch()` swallows the first emission (`effects.ts:79`) so only _changes_ fire. `onQueryEnter` subscribes to query `'qualify'` (`effects.ts:112`). Phase note (corrected): the visible `advanced.ts` calls flush `'input'` (pre-step) and `'postUpdate'` (post-step); `'update'`-phase effects fire inside `lowLevel.step`. `postUpdate` is the correct phase for contact SFX (after physics writeback).

### The four canonical usage cases

```ts
// (a) 2D UI sfx (button click) — non-spatial, no PannerNode, ui bus:
button.addComponent(
  AudioEmitter,
  createAudioEmitter({
    clip: uiClickClip,
    busId: "ui",
    simulationSpace: AudioSimulationSpace.Local,
    panningModel: AudioPanningModel.EqualPower,
  }),
);
this.effects.onQueryEnter(
  this.queries.clicked,
  (e) => bumpPlayEpoch(e, AudioEmitter),
  { phase: "input" },
);

// (b) Looping ambience (forest bed) — 2D loop, autoplay, ambient bus, STREAMED (see §6/Phase note):
world.spawn().addComponent(
  AudioEmitter,
  createAudioEmitter({
    clip: forestClip,
    busId: "ambient",
    loop: true,
    autoplay: true,
    simulationSpace: AudioSimulationSpace.Local,
    gain: 0.6,
  }),
);

// (c) Positional SFX (campfire) — world, equalpower, inverse falloff + virtualization, single voice:
campfire.addComponent(
  AudioEmitter,
  createAudioEmitter({
    clip: fireClip,
    busId: "sfx",
    loop: true,
    autoplay: true,
    distanceModel: AudioDistanceModel.Inverse,
    refDistance: 2,
    maxDistance: 40,
    rolloffFactor: 1,
    audibilityRadius: 2,
  }),
);

// (d) Music layer — streaming, music bus; crossfade via the dual music sub-bus (§7):
world.spawn().addComponent(
  AudioEmitter,
  createAudioEmitter({
    clip: combatTrack,
    busId: "music",
    loop: true,
    autoplay: true,
    simulationSpace: AudioSimulationSpace.Local,
  }),
);
```

---

## 6. Assets & Lifecycle

### Two-tier asset model

Add `"audio-clip"` to the closed `ASSET_KINDS` tuple (`packages/simulation/src/assets/types.ts`) and a `createAudioClipHandle` cloning `createParticleEffectHandle` (`handles.ts:87`). A reusable `"audio-effect"` sound-bank kind (ranges/overlap/cone defaults; the audio analog of `ParticleEffectAsset`) is a **deferred** follow-up; v1 puts defaults on the component + clip asset.

```ts
export const ASSET_KINDS = [, /* ...existing... */ "audio-clip"] as const;
export type AudioClipHandle = AssetHandle<"audio-clip">;
export const createAudioClipHandle = (id: string): AudioClipHandle =>
  createAssetHandle("audio-clip", id);
```

```ts
// render/src/assets/audio-clip.ts — frozen descriptor; NEVER a decoded AudioBuffer (mirrors particles.ts:149)
export interface AudioClipAsset {
  readonly kind: "audio-clip";
  readonly label: string;
  readonly source: { readonly url: string } | { readonly bytes: ArrayBuffer }; // ENCODED only
  readonly streaming: boolean; // false -> decode-once shared AudioBuffer (SFX); true -> MediaElementAudioSourceNode (music)
  readonly durationHint: number; // seconds (-1 unknown); feeds the deterministic completion timer
  readonly channels: number; // metadata hint only (see resampling note below)
  readonly sampleRate: number; // metadata hint only
  readonly defaultGain: number;
  readonly loop: boolean;
  readonly captionTrackId?: string; // accessibility: optional caption/subtitle track key (see §12)
}
export function createAudioClipAsset(input): AudioClipAsset;
export function validateAudioClipAsset(asset): { valid: boolean; diagnostics };
export function audioClipDependencies(asset): readonly AssetHandle[]; // [] today
```

Why ENCODED-only: `ParticleEffectAsset` stores a frozen descriptor and _never_ a GPU buffer; the GPU resource is materialized main-side from the ready asset. Audio is identical — `decodeAudioData` is an `AudioContext`-bound main-thread step, and an `AudioBuffer` is not structured-cloneable across the worker boundary, so it physically cannot live in the registry.

**Resampling clarification (critique-corrected):** `decodeAudioData` always resamples decoded PCM to the **AudioContext's** rate regardless of the clip's source rate. The context's `sampleRate` is left **unset** at construction only to avoid forcing a _context/device_ sample-rate mismatch (which itself causes a resample on output); it does **not** avoid resampling of decoded buffers. The asset's `channels`/`sampleRate` are **metadata hints**, not a promise of zero resampling.

### Loader / decode

- **Registry "ready" = encoded bytes fetched.** `register() → markLoading() → fetch → markReady()`, bumping `version` on every transition (`registry.ts:184`), mirroring `createSystemAssetAccess` (`systems/assets.ts:170`). Extraction gates on `entry.status === 'ready' && entry.asset !== null` (the particle gate) and stamps `entry.version` as `clipVersion`.
- **Decode = a separate main-thread materialization keyed by `(clipId, clipVersion)`.** Decode-once into a shared immutable `AudioBuffer` fanned out to many single-use `AudioBufferSourceNode`s — automatic by handle, where three.js requires manual buffer reuse. **Always `bytes.slice(0)` before decode** — `decodeAudioData` detaches its input. (Credit: this is the same fix three.js's `AudioLoader` already ships; aperture adopts it, it is not novel.)
- **Bounded decode queue (critique gap).** Preload issues decodes through a **concurrency-limited queue** (not unbounded "saturate the pool"), prioritizing **near/loud clips first** so a gameplay-frame decode of a far clip can't jank ahead of an imminent one. A clip that becomes ready mid-session decodes lazily on first packet, also through the bounded queue.
- **Hot-swap.** A bumped `clipVersion` triggers a re-decode under a new cache key; in-flight voices finish on the old buffer.
- **Load-deferred playback.** An emitter whose clip isn't ready isn't extracted-as-audible; it starts sounding the frame after "ready". On main, a one-shot whose `playEpoch` fires before `decodeAudioData` resolves is held as a virtual voice and promoted when the buffer lands, bounded by a ~250 ms drop window.

### AudioContext unlock / suspend / resume / game-pause (the one seam with no particle precedent)

```ts
ctx = new AudioContext({ latencyHint: "interactive" }); // sampleRate UNSET (avoid context/device mismatch)

async unlock() { // first user gesture (aperture input pipeline; see §12 open question on the hook)
  if (ctx.state === "running") return;
  await ctx.resume();
  const b = ctx.createBuffer(1, 1, ctx.sampleRate);
  const s = ctx.createBufferSource(); s.buffer = b; s.connect(ctx.destination); s.start(0); // iOS unlock + sanity-check
}
document.addEventListener("visibilitychange", () => document.hidden ? ctx.suspend() : ctx.resume());
// Safari 'interrupted' (lock/call/background): issue an extra resume() on visibility/interruption.
```

**Tab-hidden suspend vs game pause are distinct (critique mustFix).** `ctx.suspend()` halts the _whole_ graph and is correct only for tab-hidden/battery/headless-capture (per MEMORY: backgrounded contexts blank readbacks). A **game pause** (pause menu) is a separate intent expressed in the ECS and realized as **per-bus gain-to-zero / playhead-hold**, configurable per bus: typically `sfx`/`voice`/`ambient` pause while `music` and `ui` keep playing (so menu clicks and music continue). Pause intent flows via `workerSummary.signals`; the engine never `suspend()`s the context for a game pause.

While `ctx.state !== "running"`, the worker keeps emitting bumped epochs (audio is a derived view). On resume the engine reconciles: **loops** with newer epochs start mid-loop; **stale one-shots** are dropped. A per-emitter `replayOnResume` opt-in covers must-not-drop cases.

---

## 7. The Spatial Audio Engine & Performance

### Voice pool & subgraph

`AudioBufferSourceNode` is spec-mandated single-use and cheap; `PannerNode` (especially HRTF) and `BiquadFilter` are expensive and reusable. We **pool the persistent subgraph, never the source node.** (This pooling — not "three.js leaks nodes" — is the real beat over three.js; see §8.)

```
Voice (pooled): [AudioBufferSourceNode (throwaway)] ► occlusion BiquadFilter ► PannerNode ► voice.GainNode ► busGain[busId]
```

```ts
const enum VoiceState {
  Free,
  Active,
  FadingOut,
}
interface Voice {
  state: VoiceState;
  panner: PannerNode;
  occlusion: BiquadFilterNode;
  gain: GainNode;
  source: AudioBufferSourceNode | null; // SINGLE-USE; minted per play, nulled in onended
  key: AudioVoiceKey;
  realizedEpoch: number;
  realizedStopEpoch: number;
  lastClipVersion: number;
  priority: number;
  protected: boolean;
  loop: boolean;
  audibility: number;
  promotedAtCtxTime: number;
}
interface VirtualVoice {
  // node-less; retains playhead so a far loop resumes mid-loop
  key: AudioVoiceKey;
  clipKey: string;
  realizedEpoch: number;
  startedAtCtxTime: number;
  offsetSec: number;
  loop: boolean;
  loopLenSec: number;
  priority: number;
  audibility: number;
}
```

### Virtualization (before allocating any voice)

1. **Worker soft-demote (not hard cull).** Emitters beyond `maxDistance` are tagged `audibility:"inaudible"` but **still emitted** so the engine can keep/refresh a `VirtualVoice` playhead. This resolves the draft's contradiction (worker hard-cull vs main-side mid-loop resume). To bound packet volume, inaudible emitters beyond a far **`hardCullRadius` ≫ maxDistance** are dropped entirely (a sound that far away cannot meaningfully resume mid-loop; it restarts, which is documented and acceptable).
2. **Main-side ranking.** Score each candidate by `audibility = attenuatedGain · coneFactor + priority · PRIORITY_WEIGHT`, where `attenuatedGain = gain · rolloff(distanceModel, dist, refDistance, maxDistance)` and **`coneFactor` is the directional cone attenuation** (a source pointed away ranks lower — critique niceToHave folded in). `local` (2D) emitters are always-real (`score = gain·1000 + priority·1e6`). Top `MAX_VOICES` get real pooled voices; the rest become node-less `VirtualVoice`s retaining playhead, promoted/demoted as the listener moves. A far loop resumes _mid-loop_.

**Mid-loop resume when duration is unknown / streamed.** Resume offset = `(ctx.currentTime − startedAtCtxTime + offsetSec) mod loopLenSec`. `loopLenSec` is known for a decoded buffer (`buffer.duration` or `loopEnd−loopStart`). For a **streamed** (`MediaElement`) clip or `durationHint:-1`, accurate modulo is impossible — such voices **restart from `loopStart`** on promotion (documented behavior), since streamed clips are music/ambience where a phase jump is rare and tolerable.

### Voice stealing & category taxonomy

When at budget and a candidate outranks the weakest live voice:

- Steal the **lowest audibility-score** voice; **prefer stealing loops over one-shots** (a stolen loop demotes cleanly to virtual; a stolen one-shot is gone) via `STEAL_LOOP_BONUS`.
- **Never steal `protected` voices.** Protection and steal-order derive from a fixed **category taxonomy mapped from `busId`** (critique gap):

  | bus       | default priority | protection         | steal order |
  | --------- | ---------------- | ------------------ | ----------- |
  | `voice`   | high             | protected          | last        |
  | `music`   | high             | protected          | last        |
  | `ui`      | high             | never virtual (2D) | n/a         |
  | `sfx`     | medium           | stealable          | middle      |
  | `ambient` | low              | stealable          | first       |

- **Fade one-shots ~15 ms before steal** (`setTargetAtTime(0, now, 0.015)`).
- **Per-bus caps** (numbers in the budget table) so one SFX class can't starve another.
- **Hysteresis:** a freshly promoted voice gets an audibility bonus + `promotedAtCtxTime` minimum-age before it can be re-stolen, preventing fade-flicker.

### Listener & panner AudioParam updates (same proven technique as three.js — parity, not a beat)

```ts
updateVoice(v, p, transforms) {                                  // per-frame, ZERO allocation
  const o = p.worldTransformOffset, t = ctx.currentTime + clampedFrameDelta;
  v.panner.positionX.linearRampToValueAtTime(transforms[o + 12], t); // col3 = world position
  v.panner.positionY.linearRampToValueAtTime(transforms[o + 13], t);
  v.panner.positionZ.linearRampToValueAtTime(transforms[o + 14], t);
  v.panner.orientationX.linearRampToValueAtTime(transforms[o + 8], t); // cone dir from world basis
  // ...orientationY/Z...
  const targetGain = p.muted ? 0 : p.gain;
  if (v.gain.gain.value !== targetGain) v.gain.gain.setTargetAtTime(targetGain, ctx.currentTime, 0.015);
}
updateListener(L, transforms) {
  const o = L.worldTransformOffset, t = ctx.currentTime + clampedFrameDelta, l = ctx.listener;
  l.positionX.linearRampToValueAtTime(transforms[o + 12], t);
  l.forwardX.linearRampToValueAtTime(-transforms[o + 8], t);    // forward = -col2
  l.upX.linearRampToValueAtTime(transforms[o + 4], t);          // up = +col1
  master.gain.setTargetAtTime(L.masterGain, ctx.currentTime, 0.015);
}
```

`linearRampToValueAtTime(value, ctx.currentTime + clampedFrameDelta)` is sample-accurate and eliminates zipper noise. **This is the same technique three.js uses** (`PositionalAudio.js`/`AudioListener.js`) — claimed as parity, not innovation. `panningModel` defaults to **`equalpower`**; **HRTF** is opt-in per clip behind a quality flag with its own sub-budget (≤ 8 HRTF voices), because HRTF runs a per-source HRIR-pair convolution (≈2 convolutions/source — corrected from the draft's "4") that is far costlier than equalpower.

**Listener basis correctness (critique-corrected).** The listener pose must come from the **WORLD matrix** columns, _not_ the inverted view matrix (`extraction-views.ts:59` stores `invertMat4(worldMatrix)`). `AudioListenerPacket.worldTransformOffset` therefore points at the **world** matrix the camera entity's `WorldTransform` produced. `forward = −col2, up = +col1` is exact **only for a rigid (orthonormal, no negative scale)** transform — which is the contract: **listeners are asserted rigid** (a dedicated AC covers non-uniform/negative-scale transforms by either rejecting them with a diagnostic or normalizing the basis). Note three.js applies `forward=(0,0,−1)`/`up=(0,1,0)` rotated by the world quaternion rather than reading raw columns; the column read is equivalent under the rigid contract and verified by AU-5/AU-6 tests.

### Mixing buses, ducking, music transitions, FFT taps

```
voice.gain ─► busGain[music(A/B) | sfx | ui | ambient | voice] ─► (AnalyserNode tap) ─► masterGain ─► DynamicsCompressor ─► destination
```

- Per-bus/master volume and mute via `setTargetAtTime(target, now, 0.015)` — click-free (which PlayCanvas's direct `gain.value` writes lack).
- A single master `DynamicsCompressorNode` (~6 ms lookahead, on the output path of every voice — counted in the latency budget, §4) prevents clipping.
- **Ducking = scripted sidechain** (`DynamicsCompressorNode` has no external trigger input — verified): when `voice`/`ui` goes active, ramp `music`/`ambient` down ~−12 dB and back on release.
- **Music transitions (critique gap).** The `music` bus is split into **two sub-buses (A/B)** so two _different_ tracks can equal-power crossfade (a single bus-gain ramp cannot crossfade two tracks on the same bus). A small main-side **music state machine** handles `play`/`crossfadeTo`/`stinger`/`stop`; beat/bar-synced and vertical-layer mixing of the 5(d) intensity layers are **deferred** (see Deferred / Non-goals).
- **FFT analysis (critique mustFix — three.js parity).** Each bus (and master) exposes an optional `AnalyserNode` tap; `getFrequencyData()`/`getAverageLevel()` are surfaced to the app for visualizers and the diagnostics summary. This restores the `AudioAnalyser` capability the draft silently dropped.
- Bus/master gains and pause flags travel as ECS-side **Signals** in `workerSummary.signals` and are realized main-side, keeping authored mixer state in the deterministic record/replay stream. The worker **never** sets an `AudioParam`; the engine **never** mutates the signal store (Inv-6).

### Reverb / occlusion hooks

- **Reverb zones:** one shared `ConvolverNode` _per zone_ (never per voice — it runs multiple FFTs/block and copies its buffer). Voices in a zone route a send.
- **Occlusion vs obstruction (critique gap).** v1 ships **occlusion** = per-voice `BiquadFilterNode` lowpass (12 dB/oct), cutoff ramped from a worker-side raycast block factor carried on the packet _when physics is available_. **Obstruction** (muffled-but-still-audible indirect path with wet/dry mixing) and the raycast dependency itself are **deferred** to the reverb/occlusion phase (see Deferred / Non-goals), so the committed roadmap doesn't promise a physics feature that may be absent.

### AudioWorklet

The native `DynamicsCompressor` master limiter is sufficient for v1. An AudioWorklet path (WASM brickwall limiter, HOA/ambisonic) is fed by its **own** SharedArrayBuffer ring + Atomics — **independent** of the snapshot transport (clarification: the worklet ring needs cross-origin isolation; the snapshot is forced _off_ SAB for audio frames for an unrelated reason — packed-codec coverage — so the two SABs don't conflict). `process()` must do zero allocation. Both the worklet ring and the limiter **degrade to `DynamicsCompressor`** when isolation/worklet is absent.

### Concrete performance budget

| Metric                                                   | Target                                                                  | Notes                                                                                           |
| -------------------------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Real voices (desktop)                                    | `MAX_VOICES = 32`                                                       | Unity-parity reference                                                                          |
| Real voices (mobile/low-end)                             | 16                                                                      |                                                                                                 |
| Per-bus caps                                             | sfx ≤ 12, footsteps ≤ 4, gunfire ≤ 8, ambient ≤ 6, voice ≤ 2, music ≤ 2 | enforced + asserted in stress bench                                                             |
| HRTF sub-budget                                          | ≤ 8                                                                     | equalpower for the rest                                                                         |
| Main-side `applySnapshot` cost                           | < 0.3 ms                                                                | 6 pos + 3 orient + 1 gain ramp/voice; listener O(1)                                             |
| Worker `extractAudioEmitters` cost                       | asserted **separately**                                                 | distance/cone tag + packet build for N emitters/tick                                            |
| Per-frame allocation (audio render thread / main engine) | **0 bytes**                                                             | pool + free-list + reused Maps; only alloc is throwaway source node per trigger                 |
| Per-frame allocation (worker extraction)                 | N plain packet objects/tick                                             | scoped to the worker, same as `extractParticleEmitters` — NOT counted in the "0 bytes" headline |
| Audio-thread quantum                                     | 128/44100 = **2.90 ms**                                                 | equalpower/compressor cheap; convolver shared-per-zone only                                     |
| Decoded buffer memory                                    | 48000·2·4·60 = **23.04 MB/min** stereo @48k                             | music **streamed**, not decoded                                                                 |

**Benchmark plan** — two scenes: **(1)** 1000 `AudioEmitter`s orbiting the listener; **(2)** `playEpoch`/one-shot **flood** (counter wrap + burst overflow). Assert: (a) live `PannerNode` count never exceeds `MAX_VOICES` even under adversarial flooding; (b) main-side `applySnapshot` < 0.3 ms _and_ worker `extractAudioEmitters` cost separately; (c) zero steady-state GC on the engine side; (d) no XRuns; (e) the N nearest/loudest are _exactly_ the realized voices and demoted loops resume mid-loop on re-approach; (f) an **asset-churn** sub-bench (rapid `clipVersion` hot-swaps) exercising the decode cache + in-flight-old-buffer path.

---

## 8. three.js Parity & Superiority (audited)

The draft's "beats" table contained several false claims about three.js verified against `references/three.js/src/audio/*`. Corrected here. **First, the auditable parity table** (capability | three.js API | aperture mechanism | status):

| Capability                          | three.js                                                                                                        | aperture                                                              | Status                                                |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------- |
| AudioParam position ramps           | `positionX/Y/Z` + `forward/up` via `linearRampToValueAtTime` (`PositionalAudio.js:235`, `AudioListener.js:197`) | same technique, world-basis                                           | **Parity** (same proven technique; not a beat)        |
| Buffer sharing                      | `setBuffer(buffer)` reused across many `Audio`                                                                  | decode-once **auto-cached by (handle,version)**                       | **Beat** (automatic vs manual)                        |
| `slice(0)` before decode            | `AudioLoader.js:58`                                                                                             | adopted                                                               | **Parity** (credit three.js)                          |
| playbackRate / detune               | `setPlaybackRate` (`Audio.js:593`), `setDetune` (`Audio.js:537`)                                                | authored `timeScale` + **auto-Doppler from velocity**                 | **Beat** on auto-Doppler only; parity on the knob     |
| Filters                             | `setFilters([nodes])` (`Audio.js:511`), `AudioListener.setFilter`                                               | per-voice occlusion **automation**                                    | **Beat** on automation; parity on existence           |
| FFT / analysis                      | `AudioAnalyser` (`AudioAnalyser.js`)                                                                            | per-bus/master `AnalyserNode` taps                                    | **Parity** (restored — was dropped in draft)          |
| offset/duration/loopStart/loopEnd   | `source.start(when,offset,dur)`, `loopStart/End` (`Audio.js:334-338`)                                           | `offsetSec/loopStart/loopEnd` on component+packet                     | **Parity**                                            |
| onEnded / cleanup                   | `onEnded` resets `_progress`, single-use source GC'd (`Audio.js:628`)                                           | event-driven recycle + **pooled** persistent subgraph                 | **Beat** on pooling; three.js does _not_ leak sources |
| loop                                | `loop`, `setLoop`                                                                                               | `loop` + virtual mid-loop resume                                      | **Parity** + beat                                     |
| play-while-playing                  | `play()` _refuses_ while `isPlaying` (`Audio.js:316`)                                                           | priority/audibility voice stealing                                    | **Beat**                                              |
| Submix buses                        | no first-class named buses (can insert gains via filters)                                                       | `music/sfx/ui/ambient/voice` + scripted ducking                       | **Beat**                                              |
| Virtualization                      | none — N emitters = N live panners                                                                              | distance/loudness/priority/cone ranking, top-N real                   | **Beat**                                              |
| Worker/derived view                 | `Object3D`, coupled to render scene-graph                                                                       | stateless snapshot consumer, ECS `WorldTransform`                     | **Beat**                                              |
| Autoplay/unlock lifecycle           | none (silent-fail until host resumes)                                                                           | gesture-unlock + iOS + visibility + Safari interrupted + game-pause   | **Beat**                                              |
| pause/resume-from-position          | `Audio.pause()` preserves `_progress` (`Audio.js:358`)                                                          | per-voice via stopEpoch + offset; full per-emitter pause **deferred** | **Deferred** (see Non-goals)                          |
| MediaStream / arbitrary node source | `setMediaStreamSource`, arbitrary `audioNode` (`Audio.js:238`)                                                  | buffer + MediaElement only                                            | **Deferred** (out of scope, stated)                   |

**Corrected superiority claims** (the load-bearing beats, now isolated from false ones): pooled voice subgraph; distance/loudness/priority/**cone** virtualization; priority voice-stealing with loop-prefer/protect/fade/per-bus-caps; named submix buses with click-free scripted ducking; **automatic** decode-once-by-handle caching; **auto**-Doppler from radial velocity; the full autoplay/unlock/suspend/game-pause lifecycle; worker-authoritative derived-view decoupling that lets audio observe the _same frame's_ transforms.

**PlayCanvas (tightened — critique gap):** PlayCanvas _does_ have slots/`overlap` and a `SoundManager` with global volume/suspend/resume, and its click-free-gap is real (`instance.js` writes `gain.gain.value` directly with no ramp). The defensible claim is narrowed to: aperture adds **audibility-ranked virtualization and priority voice-stealing** that PlayCanvas lacks, plus click-free bus ramps — _not_ "no concurrency control at all."

---

## 9. Package Layout

`scripts/check-package-boundaries.mjs` statically forbids the headless packages (`simulation, physics, physics-rapier, render, runtime`) from importing `@aperture-engine/webgpu` or touching browser GPU globals. That rule morally extends to Web Audio.

```
@aperture-engine/simulation   (headless)
  └─ assets/types.ts          + "audio-clip" ASSET_KIND
  └─ assets/handles.ts        + createAudioClipHandle  (clone of :87)

@aperture-engine/render       (headless)
  └─ assets/audio-clip.ts                 AudioClipAsset descriptor + validate + dependencies
  └─ rendering/authoring-components-core.ts  AudioEmitter, AudioListener (intent only)
  └─ rendering/authoring-create-audio.ts     createAudioEmitter/createAudioListener
  └─ rendering/authoring-validation-audio.ts validateAudioEmitterInput
  └─ rendering/extraction-audio.ts           extractAudioEmitters, extractAudioListener
  └─ rendering/snapshot-packet-types.ts   + AudioEmitterPacket, AudioListenerPacket, AudioVoiceKey
  └─ rendering/snapshot-core-types.ts     + audioEmitters?, audioListener? on RenderSnapshot
  └─ rendering/index.js                   + re-export the new packet/listener/key types  (REQUIRED barrel step)

@aperture-engine/app
  └─ worker/snapshot.ts        + audioEmitters/audioListener in hasUnsupportedSharedSnapshotPayload (beside particleEmitters)
  └─ systems/audio.ts          worker audio system: bumps playEpoch via effects; DRAINS oneShot channel (new drain pattern)

@aperture-engine/audio   ◄── NEW, MAIN-THREAD (sibling of @aperture-engine/webgpu, NOT headless)
  └─ src/index.ts              createAudioEngine, AudioEngine interface
  └─ src/voice-pool.ts         Voice/VirtualVoice, pool + free-list
  └─ src/voice-manager.ts      audibility (incl. cone) scoring, budget, stealing, virtualization, seen-sweep teardown
  └─ src/clip-cache.ts         bounded concurrent decodeAudioData, keyed by (clipId, clipVersion)
  └─ src/mixer.ts              buses (incl. dual music A/B), master, DynamicsCompressor, ducking, AnalyserNode taps
  └─ src/music-state.ts        play/crossfadeTo/stinger/stop state machine
  └─ src/context-lifecycle.ts  unlock/suspend/resume/Safari-interrupted/game-pause
  └─ src/diagnostics.ts        audio diagnostics summary shape
  └─ src/audio-backend.ts      AudioBackend interface (mockable seam, incl. createAnalyser)
  └─ src/test-support.ts       FakeAudioBackend, offline-render + fake-clock helpers
```

```jsonc
// packages/audio/package.json
{
  "name": "@aperture-engine/audio",
  "type": "module",
  "license": "MIT",
  "sideEffects": false,
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" },
    "./test-support": {
      "types": "./dist/test-support.d.ts",
      "import": "./dist/test-support.js",
    },
  },
  "dependencies": {
    "@aperture-engine/render": "workspace:^",
    "@aperture-engine/runtime": "workspace:^",
    "@aperture-engine/simulation": "workspace:^",
  },
}
```

**Dependency edges:** `audio → render, runtime, simulation` (one-way, types only).

**Build-system edits (critique mustFix — three were silently missing):**

1. **`check-package-boundaries.mjs`:** `audio` is **not** added to `DEFAULT_HEADLESS_PACKAGES` (so it may touch Web Audio, like `webgpu` touches `navigator.gpu`); **add a forbidden-audio-global list** (`AudioContext`, `PannerNode`, `AudioListener`, `AudioWorkletNode`, `GainNode`, `ConvolverNode`, `BiquadFilterNode`, `AnalyserNode`) flagged in the headless packages, mirroring the GPU-global AST scan.
2. **Root `package.json` build chain:** insert `packages/audio` into the ordered `tsc -b ...` list (after `render`/`runtime`, alongside `webgpu` as a main-thread leaf) — otherwise `pnpm build` never compiles it.
3. **`scripts/check-package-publish-readiness.mjs`:** add `packages/audio` to the hard-coded package array — otherwise `check:publish` fails the gate.

These three are foundation-phase (AU-1) acceptance, not later cleanup.

**Main-thread integration point (critique-corrected shape).** The real consumer is inside `create-webgpu-app.ts` where `onSnapshot` wraps a `renderQueue.then(...)` that reads the **decoded** snapshot via `readWebGpuAppSharedSnapshot` (falling back to `event.snapshot`). The audio engine must hook the **same decoded snapshot, post-readback** — not a raw event — and apply the **coalescing contract** (newest per rAF) and the measured `frameDelta`. Because audio forces transferable, audio-bearing frames carry `event.snapshot`; a scene mixing audio and non-audio frames flips transport per frame, so the audio consumer handles the placeholder/shared case identically to the renderer. The consumer therefore belongs beside (or inside) the webgpu app's existing snapshot consumer / a shared runtime consumer, not a hand-rolled `onSnapshot`. Illustrative wiring (shape, not literal API):

```ts
const audio = createAudioEngine({
  resolveClip,
  buses: ["music", "sfx", "ui", "ambient", "voice"],
  maxVoices: 32,
});
canvas.addEventListener("pointerdown", () => audio.unlock(), { once: true });
document.addEventListener("visibilitychange", () =>
  document.hidden ? audio.suspend() : audio.resume(),
);
// inside the existing decoded-snapshot consumer, after readWebGpuAppSharedSnapshot, coalesced to newest/rAF:
audio.applySnapshot(decodedSnapshot, measuredFrameDelta);
```

---

## 10. Phased Roadmap

Repo style: Status / Priority / Effort / Depends-on, **visible-feature** acceptance criteria (per `docs/ACTIONABLE_ROADMAP.md:25` — observable behavior, _not_ a status field or internal count as the primary oracle), Reference, Invariants. Earliest-value-first. Append under an "Audio subsystem" section in `docs/ACTIONABLE_ROADMAP.md`.

**Invariants** (every item): **Inv-1** worker holds zero Web Audio nodes; **Inv-2** worker emits intent only; **Inv-3** engine is a pure snapshot consumer; **Inv-4** realization state never round-trips into sim; **Inv-5** non-ready/inactive emitters emit a structured diagnostic; **Inv-6** the engine never mutates the worker signal store.

> **AC convention note.** Every internal-counter check below is paired with a **player-observable PCM/behavioral oracle** as the primary criterion; the counter is a secondary engineering invariant.

### Audio-Phase 1 — Context, buses, non-spatial playback + streaming music (foundation)

- **AU-1 audio-clip asset kind + decode-once cache + ALL build-system edits.** _Depends: none._
  - AC (observable): two emitters referencing one clip both become audible in an offline PCM render after one ready transition. _(Invariant: `decodeAudioData` called once — secondary.)_
  - AC: `check:boundaries`, `pnpm build` (audio in `tsc -b`), and `check:publish` (audio in readiness list) all stay green; `render`/`simulation` remain free of Web Audio globals (new forbidden-global check).
- **AU-1.5 worker command-drain pattern + bounded one-shot drain.** _Depends: AU-1._ Establishes the (currently-unused) `.drain()` seam, a per-frame drain cap, and queue backpressure/drop policy with a diagnostic.
  - AC (observable): a flood of queued one-shots produces audible output up to the cap and a "one-shot overflow dropped" diagnostic beyond it; the snapshot size stays bounded.
- **AU-2 AudioEmitter + extractAudioEmitters + audioEmitters on snapshot + transport fallback.** _Depends: AU-1._
  - AC (observable): an entity with `AudioEmitter`+`WorldTransform`+ready clip is audible after a trigger; `active:false`/non-ready → silent + diagnostic (Inv-5).
  - AC: on a cross-origin-isolated page, an audio-bearing frame falls back to transferable with **no dropped packets** (explicit test).
- **AU-3 Master + bus graph + click-free volume + FFT taps.** _Depends: AU-2._
  - AC (observable): a `Local` one-shot on `sfx` is non-silent in an offline render; `setMasterGain`/`setBusGain` produce a _ramped_ (no instantaneous step) change on the offline gain timeline; a master `DynamicsCompressor` limits over-unity input; an `AnalyserNode` returns non-zero frequency data while a clip plays.
- **AU-4 One-shot via playEpoch + stopEpoch + loop.** _Depends: AU-2._
  - AC (observable): a one-shot-on-spawn is audible; a `loop:true` emitter stays audible across frames; `stopEpoch`/entity-removal makes it go silent **without a click** (offline waveform shows a fade, not a hard edge). _(Stable voice count — secondary.)_
- **AU-10→here: Streaming music via MediaElementAudioSourceNode.** _Depends: AU-3._ **Moved into Phase 1** (critique mis-phasing fix — Phase 1 claims to ship production music, which is impossible without streaming).
  - AC (observable): a `streaming:true` track plays through a media-element source and is audible on the `music` bus; decoded-PCM memory stays flat over a long track (no cached `AudioBuffer`).

**Ships independently as:** a complete non-spatial audio layer — UI sfx, 2D ambience, and **streamed** music with click-free mixing and FFT visualization.

### Audio-Phase 2 — Spatialization (PannerNode + listener + distance + cone)

- **AU-5 AudioListener extraction (WORLD matrix) + listener pose.** _Depends: AU-2._
  - AC (observable): an `AudioListener` (or active-Camera fallback) yields a pose resolving to camera world position + forward/up; a second active listener → diagnostic, first honored; an explicit test covers a **non-uniform/negative-scale** listener transform (rejected or normalized, never silently mirrored).
- **AU-6 PannerNode spatial voices via AudioParams.** _Depends: AU-5, AU-3._
  - AC (observable): moving a World emitter from left to right shifts L/R channel energy in an offline render; param timeline shows `positionX.linearRampToValueAtTime`, never `setPosition`.
- **AU-7 Distance attenuation + cone + (no) frustum cull.** _Depends: AU-6._
  - AC (observable): a behind-the-camera emitter **still plays** (NOT frustum-culled); beyond `maxDistance` is inaudible (soft-demote diagnostic); **a source pointed away by `coneOuterAngle` is attenuated to ~`coneOuterGain`** in an offline render (new cone AC); `equalpower` default, HRTF only under `enableHrtf`.

### Audio-Phase 3 — Voice management (pool + virtualization + stealing)

- **AU-8 Pooled subgraph + single-use sources.** _Depends: AU-6._
  - AC (observable): rapid repeated one-shots remain audible with no GC-induced dropout over N triggers. _(PannerNode count ≪ N — secondary.)_
- **AU-9 Max-voice budget + cone-aware priority stealing + virtualization + seen-sweep teardown.** _Depends: AU-8, AU-7._
  - AC (observable): with `maxVoices=K` and `K+M` requests, the **K nearest/loudest are the audible ones** in an offline render; a demoted loop is silent then becomes audible **mid-loop** after the listener approaches; a removed emitter fades out within the grace window (absent-emitter sweep). Per-bus caps audibly enforced. _(Exactly K real voices — secondary.)_

### Audio-Phase 4 — Mix realism (reverb / occlusion / ducking / music transitions)

- **AU-11 Scripted sidechain ducking + dual-bus music crossfade.** _Depends: AU-3._ AC (observable): when `voice`/`ui` activates, the offline `music` gain timeline shows a dip+recovery with no click; two different tracks equal-power crossfade on the A/B music sub-buses (both audible mid-crossfade, summed level ~constant).
- **AU-12 Shared-per-zone reverb + occlusion lowpass.** _Depends: AU-6._ AC (observable): a source inside a reverb zone has audible tail energy after it stops; an occluded source has reduced high-frequency energy vs unoccluded, ramped without a click. _(Single Convolver/zone — secondary.)_ (Obstruction wet/dry + physics-raycast dependency are **deferred**.)

### Audio-Phase 5 — AudioWorklet limiter + advanced DSP

- **AU-13 AudioWorklet brickwall limiter on master.** _Depends: AU-3._ AC (observable): over-unity input is hard-limited in an offline render; degrades to `DynamicsCompressor` when worklet/SAB-isolation absent. _(Independent SAB ring; `process()` zero-alloc — reviewed.)_
- **AU-14 Doppler via playbackRate from radial velocity (with stability spec).** _Depends: AU-7._ AC (observable): a fast emitter produces a measurable, **smooth** pitch shift; a near-stationary emitter produces **no audible warble** (dead-zone + smoothing + max-detune clamp); static sources unchanged; Doppler composes multiplicatively with authored `timeScale` and **never** feeds the sim completion timer.

### Audio-Phase 6 — Settings, pause, accessibility (production hardening)

- **AU-15 Volume/settings command channel + persistence.** _Depends: AU-3._ AC (observable): a main-thread volume slider posts a `set-bus-volume`/`set-master-volume` **command into the worker** (correct main→worker direction), which updates the deterministic signal; the value persists across reload (localStorage/IndexedDB seam) and the change is click-free.
- **AU-16 Game pause (per-bus) distinct from tab-hidden suspend.** _Depends: AU-4._ AC (observable): a pause intent silences `sfx`/`voice`/`ambient` (playheads held) while `music`/`ui` keep playing; unmuting resumes loops in phase; tab-hidden still `suspend()`s the whole context.
- **AU-17 Lifecycle reconciliation fake-clock test (highest-risk seam).** _Depends: AU-4._ AC: a fake-clock state-machine test proves resume **drops stale one-shots** and **resumes loops mid-loop**; `replayOnResume` emitters do replay.
- **AU-18 Caption/accessibility hook.** _Depends: AU-4._ AC (observable): playing a clip with `captionTrackId` emits a main-side "clip started/ended (caption X)" event a caption UI can subscribe to; a mono-downmix toggle collapses stereo to center.
- **AU-19 Audio diagnostics summary + latency compensation.** _Depends: AU-9._ AC (observable): a diagnostics summary (active/virtual voice counts, steals, dropped one-shots, per-bus level) is queryable in the repo's diagnostics-summary convention; `AudioContext.outputLatency` + a user audio-offset setting shift scheduled `start()` times measurably.

---

## 11. Testing Strategy

A thing that makes noise must be assertable headlessly. Three layers:

**1. Mockable `AudioBackend` (unit).** The engine takes an `AudioBackend`; tests inject `FakeAudioBackend` recording node creation, param ramps, `start()`/`stop()`, connections. Most voice-manager/reconciliation/stealing/virtualization logic is unit-tested with **zero Web Audio**.

```ts
export interface AudioBackend {
  readonly currentTime: number;
  readonly state: AudioContextState;
  readonly sampleRate: number;
  readonly baseLatency: number;
  readonly outputLatency: number; // latency compensation
  resume(): Promise<void>;
  suspend(): Promise<void>;
  decode(bytes: ArrayBuffer): Promise<AudioBuffer>;
  createSource(): AudioBufferSourceNode;
  createMediaSource(url: string): MediaElementAudioSourceNode;
  createGain(): GainNode;
  createPanner(): PannerNode;
  createBiquad(): BiquadFilterNode;
  createConvolver(): ConvolverNode;
  createAnalyser(): AnalyserNode; // FFT + reverb seams
  readonly listener: AudioListener;
  readonly destination: AudioDestinationNode;
}
```

Key unit assertions: signed-delta fires exactly `(playEpoch − lastRealized)` voices; first-sight/reappearance seeds `lastRealized` to avoid back-firing; **8-bit-generation emitterId aliasing** is detected via the seen-sweep; tagged-union keys keep entity/one-shot ids disjoint; reconcile starts/steals/demotes correctly at the budget boundary; spatial updates call `positionX.linearRampToValueAtTime`, **never** `setPosition`.

**2. `OfflineAudioContext` (deterministic PCM).** `startRendering()` gives a deviceless buffer. Assert RMS/peak windows (non-silence after a trigger), L/R balance for panning, cone attenuation, ducking dip+recovery, crossfade constant-power, occlusion HF reduction, mid-loop-resume phase. This is the audio analog of pixel-readback goldens — _intent → expected PCM_, not waveform timing.

**3. Lifecycle fake-clock + e2e live readback.** The OfflineAudioContext layer does **not** exercise the suspend/resume/interrupted/gesture-unlock seam (the highest-risk behavior); AU-17 adds a dedicated **fake-clock state-machine test** for resume reconciliation. The e2e layer taps the master with a `MediaStreamAudioDestinationNode`/`AnalyserNode` and reads back PCM. **Critical:** run **foreground** with the documented anti-throttle recipe — per MEMORY, backgrounded Chrome blanks WebGPU readbacks and the same throttling silences/zeros an AudioContext. Reuse the WebGPU foreground/anti-throttle harness; integration point is the existing `playwright.bg.config.ts` / `playwright.headless.config.ts` / `playwright.metal.config.ts` (repo root).

Determinism note in every test: assert **epoch/voice-state causality**, never **sim-clock sample accuracy**.

---

## 12. Risks & Open Questions

### Resolved conflicts between pillars

- **One-shot transport (decided: counter primitive + worker-authoring command).** `playEpoch`/`stopEpoch` are monotonic **counters** (signed-delta compared). Entity-less fire-and-forget routes through the **worker** command channel (corrected direction), minting transient packets with disjoint `{kind:"oneshot",seq}` keys; the drain pattern is new scope (AU-1.5).
- **`stopEpoch` (decided: include).** Explicit click-free stop, complementing `playEpoch`; one-shots still self-terminate via `onended`.
- **Asset tiers (decided: clip now, effect bank later).** v1 ships `AudioClipAsset` + component defaults; the `"audio-effect"` bank is deferred.
- **Bus authoring (decided: signals for v1).** Fixed `master/music(A/B)/sfx/ui/ambient/voice`, `busId` on the emitter, gains/pause via `workerSummary.signals`; user-defined buses deferred.
- **Voice key (decided: tagged union).** `AudioVoiceKey` makes entity/one-shot id spaces structurally disjoint and survives 8-bit-generation index reuse via the seen-sweep.

### Risks (with mitigations)

- **AudioContext lifecycle (highest risk).** Isolated in `@aperture-engine/audio` behind an offline/fake-clock state machine (AU-17).
- **`playEpoch` wrap / emitterId aliasing.** Signed wrapping delta; seen-sweep + reappearance re-seed; tagged-union keys.
- **Listener basis.** WORLD matrix (not inverted view); `forward=−col2`, `up=+col1` valid under the **rigid-listener contract**; AU-5 covers non-uniform/negative scale.
- **SAB fallback.** Forcing transferable for audio frames is the same path particles/sprites/UI already use; only pure mesh+light+env scenes forfeit SAB. AU-2 ships the explicit fallback test.
- **HRTF cost.** equalpower default; HRTF behind a flag + ≤8 sub-budget.
- **Worker-cull vs mid-loop-resume tension.** Resolved: soft-demote (still-emitted inaudible packet) up to `hardCullRadius`; beyond that, documented restart-from-zero.
- **e2e throttling.** Foreground anti-throttle recipe mandatory.
- **Master limiter latency.** ~6 ms lookahead counted in the latency budget; surfaced via `outputLatency` for compensation.

### Open questions (with recommendations)

- **Listener default & camera-change.** Auto-adopt the highest-priority active Camera when no `AudioListener` exists, with an explicit component overriding. _Recommend yes; ramp (not jump) the listener pose on a mid-session camera switch._
- **Gesture hook.** Does aperture's input pipeline expose a first-gesture event, or must the engine attach its own one-shot DOM listener, and on which element? _Recommend: prefer the input-pipeline event; fall back to a one-shot `pointerdown`/`keydown`/`touchend` on the canvas._
- **Burst overflow policy.** When `(playEpoch − lastRealized)` exceeds the per-frame budget: _Recommend cap-and-drop with a diagnostic; revisit if content needs residual-carry._
- **Seed → variation formula.** With no clip bank in v1, `seed` drives deterministic pitch/gain only; _publish the exact reproducible formula so replay matches._

### Deferred / Non-goals (and why)

- **Pure main-side `playOneShot` (transport B).** Lower latency but bypasses record/replay; deferred until a latency need justifies leaving the deterministic stream.
- **`"audio-effect"` sound-bank asset (ranges/overlap/clip-pick).** Doesn't block Phase 1–3; follow-up kind.
- **MediaStream / mic / arbitrary-node sources.** three.js supports them; out of scope for a game engine's authoring model. Stated, not silently dropped.
- **Per-emitter pause-and-resume-from-position** (distinct from game-pause and suspend). `stopEpoch`+`offsetSec` cover restart-with-offset; true `_progress`-preserving per-emitter pause is deferred.
- **Seek/scrub to a timestamp.** No `seekTo` intent in v1; deferred (revisit for cutscene-sync/rewind).
- **True multi-listener split-screen.** Web Audio has exactly one `AudioContext.listener`; a second listener is diagnosed, not supported. **Known hard limitation;** future approaches sketched: nearest-listener selection, midpoint listener, or multiple `AudioContext`s. Local co-op is acknowledged as a real case we are deferring.
- **Obstruction (wet/dry indirect path) + worker raycast dependency.** v1 ships occlusion lowpass only; obstruction and the physics-raycast block factor are deferred so the committed roadmap doesn't promise a physics feature that may be absent.
- **Beat/bar-synced + vertical-layer music re-sequencing.** v1 ships dual-bus crossfade + a play/crossfade/stinger state machine; tempo-synced transitions and coordinated intensity-layer mixing are deferred.
- **"Audio entirely disabled" platform kill switch.** Recommended as a clean whole-subsystem no-op; deferred to a small follow-up so it doesn't gate the foundation.

---

## Changelog vs draft

**three.js parity & superiority lens:**

- Corrected the false "three.js uses deprecated `setPosition`" claim — reframed the AudioParam ramp as **parity (same technique)**, not a beat; added an audited parity table (§8).
- Narrowed the Doppler claim to **auto-Doppler from velocity** (three.js has `setPlaybackRate`/`setDetune`); corrected "no filters" (three.js `setFilters`) to "beat on _automation_"; corrected the "nodes leak / no dispose" cleanup claim (three.js sources are single-use GC'd) to "beat on **pooling**."
- Restored the dropped **`AudioAnalyser`/FFT** capability via per-bus/master `AnalyserNode` taps (AU-3, backend `createAnalyser`).
- Added **`offsetSec`/`loopStart`/`loopEnd`** to component+packet for playback-window parity; added a cone-attenuation AC (AU-7).
- Credited three.js for `slice(0)` and buffer sharing; tightened the PlayCanvas comparison to "no audibility-ranked virtualization or priority stealing."

**Performance & realtime-correctness lens:**

- Promoted **`frameDelta`** from open question to a decided contract: engine-measured, **clamped** main-thread rAF delta; documented the coalesce-to-newest-per-rAF rule.
- Corrected the transport language: transforms are **transferred/detached** (not persistently shared); Doppler must **copy out** positions each frame.
- Replaced the impossible "namespaced emitterId" with a **tagged-union `AudioVoiceKey`**; added 8-bit-generation aliasing detection via a seen-sweep.
- Added master-limiter lookahead to the latency budget; softened per-OS latency numbers to "platform-dependent, tens of ms."
- Added per-bus cap numbers, separate worker-vs-main cost assertions, a flood benchmark, bounded decode queue, and clarified the worklet SAB is independent of the snapshot transport. Corrected "4 convolvers" → ~2 convolutions/source.

**Aperture-architecture-fit lens:**

- Fixed the **inverted command direction** (`commands.queue` is worker-side; `summary()` is worker→main); reframed `playOneShot` as worker-authoring + a **new** drain pattern (AU-1.5), since no `.drain()` usage exists today.
- Added the missing build-system edits: **`tsc -b` build chain** and **`check-package-publish-readiness.mjs`** (previously only `check-package-boundaries.mjs`); added the required **`rendering/index.js` barrel re-export**.
- Corrected the main-thread integration point to the real `create-webgpu-app.ts` decoded-snapshot consumer; added **Inv-6** (engine never mutates the signal store); listener reads the **WORLD** matrix not the inverted view; completion timer uses authored `timeScale` only.

**Completeness / production-scope lens:**

- Added Phase 6: **volume settings command + persistence**, **game-pause vs tab-suspend**, **caption/accessibility hook**, **diagnostics summary**, **latency compensation**.
- Pinned **mute semantics** (gain-to-zero, playhead continues) vs `active` (stop+free); resolved the worker-cull vs mid-loop-resume contradiction via **soft-demote + `hardCullRadius`**; specified absent-emitter teardown sweep.
- Moved **streaming music into Phase 1** (mis-phased), added a **dual music sub-bus** + state machine for crossfade, a Doppler **stability spec**, a **bus→category steal taxonomy**, mid-loop-resume behavior for unknown/streamed duration, and an explicit **Deferred / Non-goals** section.
- Re-anchored acceptance criteria on **player-observable PCM/behavioral oracles** (internal counts demoted to secondary), per the roadmap's AC convention.

**Kept against critique (where the draft was right):**

- `particleEmitters` **is** in `hasUnsupportedSharedSnapshotPayload` (`worker/snapshot.ts:206`, verified) — kept the "same mechanism as particles" framing; corrected only the one critique that claimed it was absent and the other that conflated it with SAB _encoding_ (the codec genuinely lacks particle/audio encoding, which is why the guard exists).
- Counter-over-event-ring, decode-once-shared-buffer, equalpower default + HRTF sub-budget, scripted ducking (DynamicsCompressor has no sidechain), `slice(0)` before decode, and the worker-authoritative derived-view seam — all verified sound and retained.
