# Racing Experience Source Audit And Aperture V1 Library Plan

Date: 2026-06-16
Status: proposed

## Executive Summary

The racing experience is a good stress test for Aperture because it is not just
a static GLB scene. It needs vehicle dynamics, follow camera behavior, live
audio modulation, smoke particles, drift trails, input/HUD plumbing, physics,
and many spawned GLB instances. The current port works by using the Aperture
runtime as a low-level substrate in several places where the library should
provide higher-level, ECS-first facilities.

The central finding is not that racing has "too much code" in the abstract. The
problem is that racing owns several engine-shaped responsibilities:

- math and transform helpers that should be shared and tested once;
- cross-system state via a module singleton instead of an ECS resource;
- browser signal polling through generated diagnostics rather than a supported
  subscription API;
- hand-built Web Audio loop graphs for vehicle engine/skid/impact audio;
- CPU smoke particles implemented as dynamic billboard meshes;
- drift marks implemented as mutable MeshAsset buffers republished every frame;
- texture decode and dynamic asset registration patterns in app code;
- GLB child lookup and material patching after spawn;
- private worker-start-option reads.

The plan below turns those gaps into Aperture library work. Racing should remain
responsible for game-specific data and tuning - track layout, vehicle feel, lap
rules, and the art direction of the smoke/audio. Aperture should own the reusable
building blocks and default paths.

## Execution Progress

- 2026-06-16: Public math helpers and generated browser signal readers landed,
  and racing/shadow-lab were migrated off app-local math files and direct
  generated-status signal parsing.
- 2026-06-16: The first ECS resource slice landed in the library:
  `@aperture-engine/app/systems` now exposes `defineResource`, `resource.*`, and
  `this.resources`; generated worker/headless status summarizes resources.
  Racing now defines `VehicleResource` and no longer uses
  `src/lib/vehicle-state.ts` as a mutable module singleton.
- 2026-06-16: Public worker start-option access landed:
  `this.startOptions` exposes filtered app-level fields such as `?map=...`,
  while engine-reserved fields such as snapshot transport buffers stay private.
  Racing and shadow-lab track setup no longer read
  `world.globals["aperture.workerStartOptions"]`.
- 2026-06-16: Public dynamic mesh access landed:
  `this.meshes.dynamic(...)` owns mesh asset registration and version bumps for
  worker-authored runtime meshes. Racing smoke particles and drift trails now
  publish mesh updates through this helper instead of touching mesh registry
  lifecycle directly.

## Goals

- Make racing smaller, clearer, and less fragile by moving reusable engine
  mechanics into Aperture.
- Keep the architecture ECS-first: no renderer-owned scene graph and no mutable
  Object3D-style source of truth.
- Use Bevy and PlayCanvas as the comparison anchors. three.js is too low-level
  for this question; the relevant benchmark is what app/game authors can avoid
  hand-writing in higher-level engines.
- Preserve worker-snapshot compatibility. Worker systems author intent; main
  thread systems realize WebGPU/Web Audio resources.
- Produce implementation slices that can each be validated with focused tests
  and racing/shadow-lab visual checks.

## Non-Goals

- Do not build a Unity-scale game framework in one step.
- Do not make vehicle physics or racing game rules a core Aperture feature.
- Do not expose renderer-owned GPU/Web Audio objects to worker systems.
- Do not replace the ECS model with a hidden scene graph.
- Do not copy PlayCanvas' scene graph API shape; borrow its higher-level
  capability coverage where it can compile down to Aperture ECS components and
  snapshots.

## Source Inventory

Racing source currently has about 3,031 lines under `src/`. The largest and most
engine-shaped files are:

- `src/systems/particles.system.ts`: 537 lines.
- `src/audio.ts`: 473 lines.
- `src/lib/track.ts`: 369 lines.
- `src/systems/vehicle.system.ts`: 317 lines.
- `src/systems/drift-marks.system.ts`: 292 lines.
- `src/systems/setup.system.ts`: 244 lines.
- `src/lib/math.ts`: 160 lines.
- `src/systems/camera-follow.system.ts`: 132 lines.
- `src/hud.ts`: 119 lines.

There are also inactive `setup.system.ts.*` files in `src/systems/`:

- `setup.system.ts.bak`
- `setup.system.ts.current`
- `setup.system.ts.minimal`
- `setup.system.ts.cube`

Those files do not currently drive the app, but they make the systems folder
harder for humans and agents to scan.

## Reference Benchmarks

### Bevy

Bevy is the closest architectural reference for Aperture because it is ECS-first
and keeps rendering/audio as derived behavior.

- Bevy's `Transform` exposes translation, rotation, scale, constructors,
  `looking_at`, `look_at`, axis helpers, local/world rotation helpers, and
  matrix conversion in one tested surface:
  `references/bevy/crates/bevy_transform/src/components/transform.rs:86`,
  `:178`, `:239`, `:277`, `:334`, `:455`.
- Bevy audio separates initial playback intent from runtime control. Its
  `PlaybackSettings` covers once/loop/despawn/remove, volume, speed, paused,
  muted, spatial, start position, and duration:
  `references/bevy/crates/bevy_audio/src/audio.rs:8`, `:28`.
- Bevy inserts an `AudioSink`/`SpatialAudioSink` control component for live
  volume/speed/play/pause/seek/stop control:
  `references/bevy/crates/bevy_audio/src/sinks.rs:9`, `:128`, `:166`.

Implication for Aperture: it is normal for an ECS-first engine to provide math,
transform, audio intent, and live audio control abstractions. Racing should not
need to implement those from scratch.

### PlayCanvas

PlayCanvas is not ECS-first in the same way, but it is a useful product API
benchmark because it packages common app/game features as components.

- PlayCanvas offers a broad component surface through `Entity#addComponent`,
  including camera, collision, light, particlesystem, rigidbody, sound, sprite,
  and render:
  `references/engine/src/framework/entity.js:336`.
- PlayCanvas `Vec3` covers construction, add/add2/addScaled, length/lengthSq,
  lerp, scalar ops, and normalize:
  `references/engine/src/core/math/vec3.js:7`, `:80`, `:147`, `:363`, `:399`,
  `:488`.
- PlayCanvas `SoundComponent` manages positional audio, slots, volume, pitch,
  looping, autoplay, play/stop, and named slot lookup:
  `references/engine/src/framework/components/sound/component.js:12`, `:440`.
- PlayCanvas `ParticleSystemComponent` covers CPU/GPU particle simulation,
  particle lifetime, rate/rate2, autoPlay, curves/gradients, billboarding, and
  renderable particle output:
  `references/engine/src/framework/components/particle-system/component.js:91`,
  `:231`, `:245`, `:263`, `:281`.

Implication for Aperture: even though Aperture should not copy PlayCanvas'
scene graph model, V1 should offer comparable high-level capabilities for
audio, particles, sprite/billboard effects, and transform ergonomics.

## Audit Findings

### 1. Math And Transform Helpers Are App-Owned

Evidence:

- `racing/src/lib/math.ts:1` says the port provides quaternion composition and
  lookAt because the Aperture public systems surface only exports
  `quatFromAxisAngle`.
- The same file implements `clamp`, `lerp`, `lerpAngle`, `remap`,
  `quatMultiply`, `quatNormalize`, `quatFromEulerYXZ`, `rotateVecByQuat`,
  `quatLookAt`, and basis-to-quaternion extraction.
- The prior `quatLookAt` sign bug is documented directly in the app helper:
  `racing/src/lib/math.ts:118`. This is exactly the kind of correctness bug
  that should live in one library test suite, not in every app.
- `camera-follow.system.ts` reimplements `normalize`, `dot`, and `lerp` at
  `racing/src/systems/camera-follow.system.ts:123`.
- `audio.ts` reimplements `clamp`, `remap`, and `lerp` at
  `racing/src/audio.ts:68`.

Current Aperture state:

- `@aperture-engine/simulation` already has a math package and exports it from
  `packages/simulation/src/index.ts`.
- It currently has useful foundations such as `Vec3Like`, `QuatLike`,
  `composeTrsMatrix`, `transformPoint`, and `quatFromAxisAngle`.
- The app systems surface only re-exports `quatFromAxisAngle`, and several
  useful helpers remain local/private, duplicated, or missing.

Library direction:

- Complete the existing `@aperture-engine/simulation/math` surface rather than
  creating a new app-local math package.
- Re-export the safe public subset from `@aperture-engine/app/systems`.
- Keep the existing array-first, WebGPU-first policy from
  `docs/research/MATH_LIBRARY_DECISION.md`.

### 2. Cross-System State Is A Module Singleton

Evidence:

- `racing/src/lib/vehicle-state.ts:1` uses a shared mutable module singleton so
  vehicle, camera, particles, drift marks, audio, and lap timer can communicate.
- `vehicle.system.ts` writes the singleton at
  `racing/src/systems/vehicle.system.ts:204`.
- `camera-follow.system.ts`, `particles.system.ts`, and
  `drift-marks.system.ts` read it directly.

Why this is a gap:

- It works only because all systems currently run in the same generated worker
  and share module identity.
- It bypasses ECS inspection, replay, snapshot/diff tooling, and resource
  typing.
- It is hard for tools to answer "what is the vehicle state right now?" without
  knowing app module internals.

Library direction:

- Add first-class ECS resources/singletons to the app system context.
- A racing `VehicleStateResource` should be readable/writable through
  `this.resources`, visible to generated-worker devtools, and serializable in
  snapshots/diffs where requested.

### 3. Browser HUD And Audio Poll Generated Diagnostics

Evidence:

- `hud.ts` reads `readGeneratedBrowserAppStatus()` and digs into
  `status.lastWorkerSummary.signals` each animation frame:
  `racing/src/hud.ts:33`.
- `audio.ts` repeats the same status parsing at `racing/src/audio.ts:56`.

Current Aperture state:

- Worker signals exist and are summarized through generated status.
- `readGeneratedBrowserAppStatus()` is a diagnostics/status API, not a stable
  app-facing signal subscription API.

Library direction:

- Add a supported browser API for app signals:
  `subscribeGeneratedSignals`, `readGeneratedSignals`, and typed generated
  signal accessors.
- Keep diagnostics status available, but app HUD/audio code should not parse it.

### 4. Audio Has A Good Low-Level Base But Missing Racing-Level Control

Evidence:

- `audio.ts` explains why it does not use high-level `AudioEngine`:
  `racing/src/audio.ts:10`. The high-level engine reconciles
  `AudioEmitterPacket`s from snapshots but does not expose an imperative/live
  loop API with playback-rate, gain, and per-voice lowpass.
- Racing builds its own loop voices, gear/RPM model, lowpass filters, skid
  loop, impact one-shot, autoplay unlock, fetch/decode, and RAF loop:
  `racing/src/audio.ts:117`, `:138`, `:218`, `:293`, `:366`, `:388`.

Current Aperture state:

- `@aperture-engine/audio` has a real main-thread audio engine, mixer, clip
  cache, voice manager, buses, diagnostics, and snapshot-driven
  `AudioEmitter`/`AudioListener` extraction.
- `startGeneratedBrowserApp({ audio: true })` exists internally, but the
  generated app config does not expose a declarative `audio` option and config
  assets do not include `audio-clip`.
- The current `AudioEmitter` packet can carry `gain`, `timeScale`, loop,
  epochs, spatial settings, and bus routing, but not a named filter chain or a
  simple live sink handle comparable to Bevy's `AudioSink`.

Library direction:

- Keep ECS-authored audio intent as the primary path.
- Add live control primitives on top of snapshot audio:
  `AudioSink`/`AudioVoiceHandle` style controls for volume, speed,
  play/pause/stop, and parameter automation.
- Add optional per-emitter filter descriptors or bus/voice effect chains
  sufficient for racing's lowpass model.
- Add declarative config support for audio clips and generated audio enablement.

### 5. Smoke Particles Are Implemented As Dynamic Meshes In App Code

Evidence:

- `particles.system.ts:26` states the engine GPU particle pipeline is a broken
  placeholder and smoke is implemented app-side as textured camera-facing quads.
- The app owns a particle pool and simulation state:
  `racing/src/systems/particles.system.ts:67`.
- The app registers sampler/texture/material/mesh handles manually:
  `racing/src/systems/particles.system.ts:118`.
- The app emits, integrates, billboards, writes vertex buffers, builds a
  `MeshAsset`, and republishes it each frame:
  `racing/src/systems/particles.system.ts:195`, `:254`, `:337`.
- The app also decodes `/sprites/smoke.png` itself because config texture assets
  do not decode to pixels for general app use and the engine image decoder is
  not public:
  `racing/src/systems/particles.system.ts:396`, `:483`.

Current Aperture state:

- Aperture has `ParticleEffectAsset`, `ParticleEmitter`, extraction, and a
  WebGPU particle frame path.
- The current WebGPU particle path is not feature-complete for racing smoke:
  effect assets carry texture/sampler fields, but the WebGPU particle frame path
  does not bind/sample those textures; it also does not expose an app-facing
  event emission API tied to wheel contact.

Library direction:

- Make the Aperture particle path production-usable for common billboard smoke.
- Add event/burst emission from worker systems.
- Support textured billboards, alpha blending, depth behavior, curves over
  lifetime, world-space simulation, and deterministic seeds.

### 6. Drift Marks Are A Trail/Ribbon Renderer In Disguise

Evidence:

- `drift-marks.system.ts:19` ports the reference drift mark system as two
  dynamic vertex-colored triangle meshes.
- `DriftTrail` manually owns typed vertex/index buffers and republished mesh
  assets:
  `racing/src/systems/drift-marks.system.ts:47`, `:99`, `:165`.
- App code builds the unlit alpha material and spawns one mesh per trail:
  `racing/src/systems/drift-marks.system.ts:222`, `:252`.
- The app uses a Y offset because polygon offset/depth bias is not available
  through the material render state in the needed path:
  `racing/src/systems/drift-marks.system.ts:24`.

Current Aperture state:

- Dynamic meshes are possible because systems can access `assetsRegistry`.
- But the app must manually author low-level `MeshAsset` descriptors, bounds,
  material assets, and per-frame version bumps.

Library direction:

- Add either a `Trail`/`Ribbon` render authoring primitive or a public dynamic
  mesh builder.
- Add polygon offset/depth bias support through material render state where it
  belongs.

### 7. GLB Spawn And Hierarchy Ergonomics Are Too Low-Level

Evidence:

- `vehicle.system.ts` resolves GLB child nodes by scanning every entity with
  `AppEntitySource` and `Name`:
  `racing/src/systems/vehicle.system.ts:282`, `:303`.
- `setup.system.ts` patches all imported GLB materials after load to force
  front-side culling:
  `racing/src/systems/setup.system.ts:54`.
- `decorations.system.ts` spawns many individual GLB instances with similar
  transforms:
  `racing/src/systems/decorations.system.ts:35`.

Current Aperture state:

- `spawn.gltf()` returns the root entity and attaches source metadata.
- It does not return a structured handle with child lookup, named nodes, mesh
  entities, or material override results.

Library direction:

- `spawn.gltf()` should return or be paired with a `GltfInstance` lookup helper.
- Material/render-state overrides should be authorable during spawn rather than
  after registry scanning.
- Batch/instanced spawn helpers should reduce repeated decoration boilerplate.

### 8. Worker Start Options Are Reached Through A Private Global

Evidence:

- `track.ts` reads `aperture.workerStartOptions` directly:
  `racing/src/lib/track.ts:266`.

Library direction:

- Expose `this.startOptions` or `this.urlParams` on the system context.
- Preserve structured-clone safety and generated-worker inspectability.

### 9. Camera Follow Is Mostly Game Logic, But Uses Missing Primitives

Evidence:

- The camera system implements speed lead, deadzone clamp, exponential smoothing,
  look point, eye point, and lookAt:
  `racing/src/systems/camera-follow.system.ts:44`, `:79`, `:97`.

Interpretation:

- The exact racing camera behavior is game-specific and should stay in the app.
- The math, transform writing, and optional reusable "follow camera with offset,
  smoothing, lead, and deadzone" helper are good library/example candidates.

Library direction:

- First add math/transform APIs.
- Later add a small optional controller helper, probably in app/controllers or
  examples, not in core render.

### 10. Track Data And Physics Collider Generation Are Mostly App-Owned

Evidence:

- `track.ts` owns the tile codec, decoration buckets, spawn position, and bounds.
- `physics-colliders.ts` generates ground and wall colliders from track cells.

Interpretation:

- This is largely racing-specific domain logic and should not become core
  Aperture API.
- The reusable pieces are public start options, math helpers, and possibly a
  generic compound collider/builder helper.

### 11. Readability Hygiene Issues

Evidence:

- Inactive setup systems live in the active systems folder.
- `setup.system.ts:177` has stale "BISECT black-screen" comments.
- `setup.system.ts:241` and `decorations.system.ts:55` silence unused imports
  with `void`.
- `track.ts` mixes large data arrays, codec utilities, runtime URL parameter
  reads, spawn/bounds helpers, and formatting that is hard to scan.

Library direction:

- Some readability improves naturally when engine-shaped code moves into
  Aperture.
- Racing should still split data from logic after the library work lands.

## Proposed Aperture API Work

### API 1: Complete Public Math And Transform Helpers

Packages:

- `packages/simulation/src/math/*`
- `packages/app/src/systems.ts`
- `packages/app/src/systems/spawn/transforms.ts`
- tests under `test/simulation` and `test/app`

Add or promote:

- Scalars: `clamp`, `clamp01`, `lerp`, `inverseLerp`, `remap`,
  `expSmoothingAlpha`, `lerpAngle`.
- Vec3: `vec3Add`, `vec3Sub`, `vec3Scale`, `vec3AddScaled`, `vec3Dot`,
  `vec3Cross`, `vec3Length`, `vec3LengthSq`, `vec3Normalize`,
  `vec3Distance`, `vec3ProjectOnPlane`.
- Quat: `quatIdentity`, `quatNormalize`, `quatMultiply`, `quatFromEuler`,
  `quatFromEulerYXZ` or a general order-aware helper, `quatLookAt`,
  `rotateVec3ByQuat`.
- Transform helpers: `setLocalTranslation`, `setLocalRotation`,
  `setLocalScale`, `lookAt(entity, target, up?)`, `readWorldPosition`,
  `readLocalTransform`, `writeLocalTransform`.

Acceptance criteria:

- `racing/src/lib/math.ts` can be deleted.
- `camera-follow.system.ts`, `vehicle.system.ts`, `audio.ts`, and
  `lap-timer.system.ts` stop defining duplicate scalar/vector/quaternion
  helpers.
- Tests lock lookAt conventions, Euler order, quaternion multiplication order,
  and zero/parallel-up fallback behavior.
- The public API remains array-first and does not introduce math classes into
  ECS component storage.

Reference anchors:

- Bevy transform helper surface:
  `references/bevy/crates/bevy_transform/src/components/transform.rs:178`,
  `:277`, `:334`, `:455`.
- PlayCanvas math coverage:
  `references/engine/src/core/math/vec3.js:7`, `:399`, `:488`.

### API 2: ECS Resources / Singleton State

Packages:

- `packages/simulation`
- `packages/app/src/systems/context.ts`
- generated-worker devtools

Target shape:

```ts
const VehicleState = defineResource("racing.vehicle", {
  ready: resource.boolean(false),
  sphere: resource.vec3([3.5, 0.5, 5]),
  container: resource.vec3([3.5, 0, 5]),
  yaw: resource.float32(0),
  forward: resource.vec3([0, 0, 1]),
  linearSpeed: resource.float32(0),
  modelVelocity: resource.vec3([0, 0, 0]),
  driftIntensity: resource.float32(0),
  throttle: resource.float32(0),
});

this.resources.write(VehicleState, (state) => {
  state.ready = true;
  state.linearSpeed = this.#linearSpeed;
});
```

Implementation notes:

- Resources should be ECS/simulation owned, not renderer owned.
- They need deterministic serialization and devtools summaries.
- They should support hot access without per-frame object churn.
- They should have generated-worker query/diff support.

Acceptance criteria:

- `racing/src/lib/vehicle-state.ts` can be deleted.
- Camera, particles, drift marks, lap timer, and vehicle systems communicate
  through the resource.
- MCP/CLI/entity tools can inspect the resource without app-specific code.

Reference anchor:

- Bevy resources and ECS app scheduling are the conceptual model, but adapt the
  API to TypeScript and Aperture's worker boundary.

### API 3: Supported Browser Signal API

Packages:

- `packages/app/src/browser/signals.ts` new
- `packages/app/src/browser.ts`
- generated browser bootstrap/runtime status

Target shape:

```ts
import {
  subscribeGeneratedSignals,
  readGeneratedSignals,
} from "@aperture-engine/app/browser";

const unsubscribe = subscribeGeneratedSignals((signals) => {
  hud.current.textContent = formatTime(signals.currentLapTime);
});

const speed = readGeneratedSignals()?.speed ?? 0;
```

Implementation notes:

- Do not ask app code to parse `lastWorkerSummary`.
- Support "latest snapshot only" semantics for HUD/audio.
- Return a stable typed shape when generated declarations are available, and a
  safe record shape otherwise.

Acceptance criteria:

- `hud.ts` no longer imports `readGeneratedBrowserAppStatus` for signals.
- `audio.ts` no longer parses generated diagnostics for speed/throttle/drift.
- Diagnostics status remains available for tooling.

### API 4: Texture, Audio, And Particle Asset Config

Packages:

- `packages/app/src/config`
- `packages/app/src/systems/assets.ts`
- `packages/render/src/materials/gltf-texture-browser-decoder.ts`
- `packages/render/src/assets/audio-clip.ts`
- `packages/render/src/assets/particles.ts`

Add config helpers:

```ts
asset.texture("/sprites/smoke.png", {
  preload: "blocking",
  colorSpace: "srgb",
  semantic: "base-color",
});

asset.audio("/audio/engine.ogg", {
  preload: "blocking",
  durationHint: 2.1,
});

asset.particleEffect({
  texture: "smoke",
  capacity: 1280,
  lifetime: { min: 2.5, max: 2.5 },
  blendMode: "alpha",
});
```

Implementation notes:

- Config texture assets must decode to real `TextureAsset` source data, not
  ready metadata stubs.
- Re-export or wrap a public browser-worker image decoder.
- Add `audio-clip` and `particle-effect` config asset kinds.
- Preserve test/headless injection paths for environments without browser image
  decode primitives.

Acceptance criteria:

- Racing smoke does not fetch/decode `/sprites/smoke.png` in app code.
- Racing audio clips are declared in `aperture.config.ts`.
- Particle effects can be declared or registered through public app APIs.

### API 5: Audio V1.1 Live Controls And Filters

Packages:

- `packages/audio`
- `packages/render/src/rendering/authoring-components-core.ts`
- `packages/render/src/rendering/extraction-audio.ts`
- `packages/app/src/browser/audio.ts`
- `packages/app/src/config`

Target capabilities:

- Config-level generated audio enablement.
- `AudioEmitter` live fields for `gain`, `timeScale`, loop, epochs, bus, and
  optional filter/effect chain.
- Main-side sink/handle semantics comparable to Bevy `AudioSink`, but safe
  across the worker boundary.
- Parameter automation helpers: linear ramp, setTarget, immediate set.
- Per-voice or per-bus lowpass filter sufficient for racing engine audio.
- One-shot event helper for impact sounds.

Possible TypeScript shape:

```ts
this.audio.emitLoop("engine", {
  clip: this.assets.audio("engine"),
  bus: "sfx",
  gain: 0,
  timeScale: 1,
  filters: [{ kind: "lowpass", frequency: 7000, q: 0.7 }],
});

this.audio.set("engine", {
  gain: ramp(engineVol, 0.03),
  timeScale: ramp(pitch, 0.03),
  filters: [{ kind: "lowpass", frequency: setTarget(cutoff, 0.05) }],
});

this.audio.playOneShot("impact", {
  clip: this.assets.audio("impact"),
  gain: vol,
});
```

Important design point:

- Worker systems should author the audio model. The main thread should realize
  it from snapshots. Avoid returning raw `AudioNode`, `AudioBufferSourceNode`,
  or `AudioParam` to worker code.

Acceptance criteria:

- `racing/src/audio.ts` shrinks from 473 lines to racing-specific audio model
  logic, or disappears in favor of systems updating audio components/resources.
- Gear/RPM pitch, engine lowpass, skid loop, and impact one-shot are all
  supported without app-created Web Audio nodes.
- Autoplay unlock and context lifecycle are owned by Aperture.

Reference anchors:

- Bevy playback settings and sinks:
  `references/bevy/crates/bevy_audio/src/audio.rs:28`,
  `references/bevy/crates/bevy_audio/src/sinks.rs:128`.
- PlayCanvas sound component and slots:
  `references/engine/src/framework/components/sound/component.js:12`,
  `:440`.

### API 6: Production Billboard Particles

Packages:

- `packages/render/src/assets/particles.ts`
- `packages/render/src/rendering/authoring-components-core.ts`
- `packages/render/src/rendering/extraction-particles.ts`
- `packages/webgpu/src/app/particles.ts`
- `packages/webgpu/src/render/particles/particle-pipeline.ts`
- `packages/app/src/systems/spawn`

Target capabilities:

- `spawn.particles()` or `withParticleEmitter()` through the app facade.
- Textured billboard rendering with sampler/texture dependencies.
- World-space simulation in X/Y/Z.
- Alpha blend and depth behavior suitable for smoke.
- CPU or GPU implementation detail hidden behind the same authoring API.
- Burst/event emission from systems:

```ts
const smoke = this.particles.effect("racing.smoke");
this.particles.emit(smoke, {
  position: wheel,
  count: 3,
  velocity: { min: [-0.1, 0.5, -0.1], max: [0.1, 1.0, 0.1] },
  lifetime: 2.5,
  size: {
    start: [0.5, 1.0],
    overLife: [
      [0, 0.5],
      [1, 3.0],
    ],
  },
  color: {
    start: [0x5e / 255, 0x5f / 255, 0x6b / 255, 0.25],
    end: [1, 1, 1, 0],
  },
});
```

Acceptance criteria:

- Racing smoke no longer builds `MeshAsset` manually.
- `ParticleEffectAsset.texture` and `sampler` are actually consumed by the
  WebGPU particle renderer.
- A browser test verifies textured particles render nonblank pixels and respect
  alpha/depth behavior.
- Racing parity screenshot shows smoke comparable to the reference when
  drifting.

Reference anchor:

- PlayCanvas particle component:
  `references/engine/src/framework/components/particle-system/component.js:91`.

### API 7: Trail/Ribbon Or Dynamic Mesh Builder

Packages:

- `packages/render/src/mesh`
- `packages/app/src/systems/assets.ts`
- `packages/app/src/systems/spawn`
- `packages/webgpu` material render state

Two possible levels:

1. High-level:

```ts
const trail = this.trails.create({
  material: "drift-mark",
  width: 0.08,
  maxSegments: 4096,
  mode: "ground-ribbon",
  fade: "vertex-alpha",
});

trail.addSegment(previousWheel, currentWheel, { alpha });
```

2. Lower-level but still safe:

```ts
const mesh = this.assets.dynamicMesh({
  label: "Drift trail",
  layout: ["POSITION:float32x3", "NORMAL:float32x3", "TEXCOORD_0:float32x2", "COLOR_0:float32x4"],
  maxVertices: 4096 * 6,
  maxIndices: 4096 * 6,
});

mesh.write((writer) => {
  writer.triangle(...);
});
```

Implementation notes:

- The builder should own bounds updates, index formats, version bumps, and
  validation.
- Add render-state depth bias / polygon offset support so apps do not rely on
  arbitrary Y offsets for coplanar decals/trails.

Acceptance criteria:

- `racing/src/systems/drift-marks.system.ts` no longer constructs raw
  `MeshAsset` descriptors or calls `assetsRegistry.markReady` per frame.
- Drift marks remain visually stable without z-fighting.

### API 8: GLTF Instance Lookup And Spawn Overrides

Packages:

- `packages/app/src/systems/spawn/gltf.ts`
- `packages/app/src/entities/lookup`
- `packages/render/src/assets/gltf-ecs-command-replay-types.ts`

Target shape:

```ts
const vehicle = this.spawn.gltf(this.assets.gltf("vehicle-truck-yellow"), {
  key: "player.vehicle",
  materialOverrides: { all: { renderState: { cullMode: "back" } } },
  castShadow: true,
  receiveShadow: true,
});

const body = this.gltf.node(vehicle, "body");
const wheels = this.gltf.nodes(vehicle, /wheel/);
```

Implementation notes:

- Preserve ECS entities as the source of truth.
- The helper can be a lookup over `AppEntitySource`, `Name`, and root entity,
  not a scene graph object.
- Return structured diagnostics for missing/duplicate node names.

Acceptance criteria:

- `vehicle.system.ts` no longer scans all nodes to find body/wheels every
  update.
- `setup.system.ts` no longer scans all material assets to force culling.
- Decorations can use a batch/instanced helper or at least a compact public
  spawn-list utility.

Reference anchors:

- PlayCanvas component and descendant lookup ergonomics:
  `references/engine/src/framework/entity.js:336`, `:416`.

### API 9: Public Start Options

Packages:

- generated worker startup
- `packages/app/src/systems/context.ts`
- devtools status

Target shape:

```ts
const map = this.startOptions.string("map");
```

or:

```ts
const map = this.urlParams.get("map");
```

Acceptance criteria:

- `track.ts` no longer reads `world.globals["aperture.workerStartOptions"]`.
- Invalid/missing options have typed fallbacks and are visible in diagnostics.

### API 10: Optional Gameplay Helpers

Packages:

- `packages/app/src/controllers`
- examples/templates

Candidates:

- `createFollowCameraController`
- `createVirtualJoystick`
- small kinematic/vehicle example helpers

Guidance:

- Keep these outside core render/simulation until they prove broadly useful.
- They should compile down to ECS components, resources, input actions, and
  systems.

## Migration Plan

### Phase 0: Baseline And Guardrails

Work:

- Add this plan to docs.
- Add a racing source-size and dependency inventory script or manual baseline.
- Capture current racing visual baselines for shadow, smoke, drift marks, HUD,
  and audio behavior.

Acceptance criteria:

- No behavior change.
- `pnpm run typecheck` passes in `racing`.
- Root focused docs check passes if docs tooling requires it.

### Phase 1: Math, Resources, Signals, Start Options

Work items:

- RACE-LIB-01: Complete and export math helpers.
- RACE-LIB-02: Add transform read/write/lookAt helpers.
- RACE-LIB-03: Add ECS resources/singletons.
- RACE-LIB-04: Add browser signal subscription/read API.
- RACE-LIB-05: Add public worker start options.

Racing migration:

- Delete `src/lib/math.ts`.
- Replace `vehicleState` module singleton with `VehicleStateResource`.
- Replace HUD/audio status parsing with signal subscriptions.
- Replace private map-param global access with `this.startOptions`.

Validation:

- Root math tests.
- App generated-worker resource query/diff tests.
- Racing typecheck/build.
- Browser smoke with HUD signal updates.

### Phase 2: Asset Config And Audio

Work items:

- RACE-LIB-06: Add `asset.audio` and generated config audio enablement.
- RACE-LIB-07: Add audio sink/live-control/filter model.
- RACE-LIB-08: Migrate racing engine/skid/impact audio to Aperture audio.

Racing migration:

- Declare engine/skid/impact clips in `aperture.config.ts`.
- Move gear/RPM model into a worker system or resource-driven audio system.
- Remove manual Web Audio graph creation from `src/audio.ts`.

Validation:

- Audio unit tests for loop speed/gain/filter snapshots.
- Browser test proves autoplay unlock and active voices.
- Manual racing check confirms engine pitch, skid loop, and impact one-shot.

### Phase 3: Texture Decode, Particles, Trails

Work items:

- RACE-LIB-09: Make config textures decode to real `TextureAsset` data.
- RACE-LIB-10: Finish textured billboard particle renderer.
- RACE-LIB-11: Add particle burst/event emission API.
- RACE-LIB-12: Add trail/ribbon or dynamic mesh builder.
- RACE-LIB-13: Wire material depth bias / polygon offset.

Racing migration:

- Replace `particles.system.ts` with a compact particle emitter/update system.
- Replace `drift-marks.system.ts` with trail/ribbon calls or dynamic mesh
  builder calls.
- Remove app image decode code.

Validation:

- WebGPU particle tests for textured alpha billboard output.
- Dynamic trail tests for bounds/version updates.
- Racing drift visual check for smoke and tire marks.

### Phase 4: GLTF Spawn Ergonomics And Material Overrides

Work items:

- RACE-LIB-14: Add GLTF instance node lookup helper.
- RACE-LIB-15: Add spawn-time material/render-state overrides.
- RACE-LIB-16: Add batch/instanced spawn helper if decoration count remains
  noisy after lookup/override work.

Racing migration:

- Replace vehicle child-node scanning with instance lookup.
- Replace global material registry patching with spawn overrides or imported
  material defaults.
- Simplify decoration spawning if a batch helper lands.

Validation:

- GLTF lookup tests for named node success, missing node, duplicate node.
- Material override tests through render extraction.
- Racing typecheck/build and visual smoke.

### Phase 5: Racing Source Cleanup

Work:

- Remove inactive `setup.system.ts.*` files or move them to a clearly ignored
  archive outside active system globs.
- Remove stale bisect comments and unused-import `void` lines.
- Split `track.ts` into:
  - `track-data.ts`
  - `track-codec.ts`
  - `track-layout.ts`
  - `track-runtime.ts`
- Keep racing-specific tuning in `tuning.ts`.
- Add short module comments only where they explain domain-specific behavior.

Acceptance criteria:

- Racing source is smaller and easier to scan.
- The systems folder contains only active systems.
- No behavior change except those intentionally introduced by prior phases.

## Expected End State For Racing

Target reductions:

- `src/lib/math.ts`: deleted.
- `src/lib/vehicle-state.ts`: deleted or replaced by resource declaration.
- `src/audio.ts`: deleted or reduced from 473 lines to a thin app-specific audio
  model wrapper.
- `src/systems/particles.system.ts`: reduced from 537 lines to emitter config
  and wheel-emission logic.
- `src/systems/drift-marks.system.ts`: reduced from 292 lines to trail setup
  and wheel segment emission.
- `src/systems/vehicle.system.ts`: smaller child lookup and transform writes.
- `src/hud.ts`: no generated-status parsing.
- `src/lib/track.ts`: split by responsibility.

The app should read as:

- setup spawns track, camera, lights, colliders, decorations;
- vehicle system owns racing vehicle dynamics;
- camera system owns camera behavior;
- lap system owns lap timing;
- particle/trail/audio systems author intent through Aperture APIs;
- Aperture handles math, resources, signals, assets, audio realization,
  particles, dynamic geometry, and GLB lookup.

## Validation Matrix

Root library validation:

- `pnpm run build`
- `pnpm run typecheck:test`
- focused Vitest for math/resources/audio/particles/dynamic mesh/gltf lookup
- focused Playwright for textured particles/trails and generated audio where
  possible

Racing validation:

- `pnpm run typecheck`
- `pnpm run build`
- run through managed Aperture dev tooling, not raw CDP
- screenshot/visual checks for:
  - shadow quality against shadow-lab and reference racing image;
  - smoke while drifting;
  - drift marks;
  - HUD lap timer;
  - vehicle/camera stability;
  - engine/skid/impact audio after first gesture.

Shadow-lab validation:

- Confirm the automatic directional shadow path still produces the expected
  sharper shadow result after any render/material changes.

## Risks And Design Decisions To Make

- Particle CPU vs GPU split: V1 can hide this behind one API, but the first
  implementation should choose the simplest path that produces correct racing
  smoke and testable pixels.
- Audio live controls: do not leak main-thread `AudioNode`s to worker code.
  Use snapshot-authored parameters or main-thread handles keyed by stable voice
  ids.
- Resource serialization: resources must be inspectable without turning every
  frame into a large JSON payload.
- Dynamic mesh builder: useful for racing, debug drawing, gizmos, and editor
  tools, but it must not become a hidden scene graph.
- GLTF lookup: return ECS entities or lookup handles, not mutable node objects.
- API placement: core math/resources belong in `simulation`/`app`; racing-style
  camera/joystick helpers should start in `app/controllers` or templates.

## Recommended Next Implementation Slice

Start with API 1 and API 3 together:

1. Promote math helpers from existing `simulation/math` and app-private
   transform code into a tested public surface.
2. Add browser signal subscription/read helpers.
3. Migrate racing off `src/lib/math.ts` and generated-status signal parsing.

Reason:

- This is low-risk, immediately removes duplicated code, and gives the rest of
  the work cleaner primitives.
- It does not require solving particles/audio/dynamic mesh in the same diff.
- It establishes the pattern for turning racing pain into library API plus
  focused validation.
