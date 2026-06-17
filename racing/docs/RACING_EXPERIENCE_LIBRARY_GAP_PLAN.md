# Racing Experience Source Audit And Aperture V1 Library Plan

Date: 2026-06-16
Status: in progress

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
- vehicle audio intent that should be worker-authored instead of
  browser-RAF-driven;
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
- 2026-06-16: Public browser image decode access landed:
  `decodeImageUrlToTextureSource(...)` wraps the renderer's browser canvas
  decoder for app-authored texture source data. Racing smoke now uses the
  library helper instead of carrying a private `fetch`/`createImageBitmap`/
  `OffscreenCanvas` decoder.
- 2026-06-16: Declarative audio clip config landed:
  `asset.audio(...)` now registers config-authored `audio-clip` source assets
  with encoded bytes for non-streaming clips, generated browser apps can opt
  into audio through `audio: true`, and racing declares its engine/skid/impact
  clips in `aperture.config.ts`.
- 2026-06-16: Config texture decode landed:
  `asset.texture(...)` can now decode browser images into real `TextureAsset`
  source data with color-space/semantic validation. Racing declares the smoke
  sprite in `aperture.config.ts`, and `particles.system.ts` no longer fetches
  or decodes image pixels itself.
- 2026-06-16: Declarative particle-effect config landed:
  `asset.particleEffect(...)` now registers config-authored
  `particle-effect` source assets with texture/sampler dependencies. Racing
  declares its smoke effect data in `aperture.config.ts`, ready for the
  follow-up emitter renderer migration.
- 2026-06-16: Public particle emitter spawning landed:
  `this.spawn.particles(...)` now authors renderer-independent
  `ParticleEmitter` components from app systems. Racing's smoke system now
  consumes the config-authored `smoke-effect` texture dependency instead of
  looking up the sprite separately.
- 2026-06-16: Textured particle billboard rendering landed:
  the WebGPU particle frame path now binds and samples
  `ParticleEffectAsset.texture`/`sampler` dependencies, falls back to default
  white texture plus linear sampler resources, specializes particle pipelines by
  blend mode, and depth-tests without depth writes for smoke-style alpha
  particles.
- 2026-06-16: Particle burst emission landed:
  `this.particles.emit(...)` queues worker-authored transient burst requests,
  extraction turns them into burst-mode particle packets, and WebGPU advances
  renderer-owned live burst state through the same textured billboard renderer.
  Racing wheel smoke no longer registers sampler/material/mesh assets or builds
  a `MeshAsset` every frame. The default active burst budget now covers
  sustained two-wheel smoke emission without overflow diagnostics.
- 2026-06-16: Ground-ribbon trail authoring landed:
  `this.trails.groundRibbon(...)` now owns dynamic trail mesh layout, unlit
  alpha material registration, bounds, index format selection, spawn handles,
  and mesh version bumps. Racing drift marks now call `track(...)`/`flush()`
  on library trail handles instead of constructing raw `MeshAsset` descriptors
  or touching `assetsRegistry.markReady` per frame.
- 2026-06-16: Material depth bias / polygon offset landed for built-in material
  pipelines: render-state depth bias now participates in material pipeline
  keys, WebGPU depth-stencil descriptors, and render-pipeline cache keys.
  `this.trails.groundRibbon(...)` exposes the bias fields, and racing drift
  marks request the shared material path instead of relying only on a
  geometry-offset workaround.
- 2026-06-16: Public GLTF instance lookup landed:
  `@aperture-engine/app/systems` now exposes `this.gltf.node(...)` and
  `this.gltf.nodes(...)` with structured diagnostics for inactive roots,
  missing nodes, and duplicate names. The helper walks the fast `Children`
  index when present and falls back to authoritative `Parent` links for raw
  GLTF replay subtrees. Racing vehicle child-node lookup now uses the shared
  helper instead of scanning an app-owned query every fixed step.
- 2026-06-16: Spawn-time GLTF material overrides landed:
  `this.spawn.gltf(...)` now accepts `materials.renderState` overrides,
  clones/reuses patched source material assets keyed by source material plus
  override hash, and retargets only spawned subtree mesh `Material`
  components. Racing and shadow-lab now request `cullMode: "back"` at each
  GLTF spawn site instead of scanning every ready material asset in
  `setup.system.ts`.
- 2026-06-16: Repeated GLTF spawn batching landed:
  `this.spawn.gltfBatch(...)` now spawns repeated imported subtrees with shared
  tags, material overrides, shadow flags, and per-instance transforms while
  delegating to the ordinary ECS `spawn.gltf(...)` path. Racing and shadow-lab
  decoration buckets now use the helper instead of repeating identical GLTF
  spawn options inside each loop.
- 2026-06-16: Racing source cleanup started:
  inactive `setup.system.ts.*` scaffolding files were removed from the active
  systems directory, decoration placeholder imports were deleted, and
  `racing/src/lib/track.ts` is now a stable barrel over focused
  `track-data.ts`, `track-codec.ts`, `track-layout.ts`, and
  `track-runtime.ts` modules.
- 2026-06-16: Main-thread audio graph ownership moved into the library:
  `@aperture-engine/audio` now exports a sound board API for named clip
  preload/decode/cache, first-gesture startup, loop voices, one-shots,
  gain/playback-rate automation, lowpass filters, mixer routing, and teardown.
  Racing keeps the vehicle-specific RPM/skid/impact model, but no longer
  creates raw Web Audio nodes in `src/audio.ts`.
- 2026-06-16: Worker-authored racing audio intent landed:
  `@aperture-engine/app/systems` now exposes `this.audio.loop(...)`,
  `this.audio.set(...)`, `this.audio.stop(...)`, and
  `this.audio.playOneShot(...)` for stable loop and one-shot ECS audio intent.
  `AudioEmitter` snapshots now carry authored lowpass frequency/Q into the
  main-thread voice manager, and racing's RPM/skid/impact model moved to
  `src/systems/audio.system.ts`; `src/audio.ts` was deleted.
- 2026-06-16: Fixed-step presentation interpolation was tightened for GLTF-style
  hierarchies: render packets beneath an opted-in parent now compose their
  outgoing snapshot world matrix from the parent's interpolated local sample
  plus the child's current local transform. `this.gltf.node(s)` now filters out
  hidden primitive render children and returns only authored GLTF scene/node
  records. Racing and shadow-lab serve the rebuilt shared `@aperture-engine/app`
  dist modules, and Shadow Lab compare mode now initializes orbit distance from
  the authored racing camera offset instead of a hard-coded short radius.
- 2026-06-16: Particle rendering now works through the queued built-in, mixed
  custom WGSL, and custom WGSL frame routes, and scene-pass helpers use the
  actual scene color target format in HDR apps. Racing smoke exposed the bug:
  particle pipelines were keyed for the swapchain `bgra8unorm` target while the
  active HDR scene pass expected `rgba16float`, so WebGPU rejected the command
  buffer when smoke emitted.
- 2026-06-16: Public follow-camera control landed:
  `createFollowCameraController(...)` now owns lead projection, deadzone
  clamping, exponential smoothing, look-at pose generation, and optional
  `RenderInterpolation` opt-in for ECS camera entities. Racing's
  `camera-follow.system.ts` now keeps only racing tuning data and vehicle lead
  velocity calculation in app code.
- 2026-06-16: Racing smoke received focused regression/proof coverage:
  `racing/test/racing/particles-system.test.ts` drives the real racing
  `ParticlesSystem` over config-authored textured particle-effect assets and
  asserts two smoke bursts when `VehicleResource.driftIntensity` exceeds the
  Starter-Kit threshold. A managed Aperture MCP proof then paused racing, drove
  `drive=[1,1]` through worker input, stepped fixed simulation until live smoke
  rendered, and observed `particleEmitters: 10`, `liveParticles: 30`,
  `texturedEmitters: 10`, and zero diagnostics.
- 2026-06-16: Compact generated-worker resource inspection landed:
  the generated devtools bridge, CLI dispatch, and MCP tool list now expose
  `resource_get` for listing app resources or reading one resource by id
  without dumping full browser status/entity reports. Racing proof used it to
  read `racing.vehicle` while paused, then deterministically stepped
  `drive=[1,1]` until `driftIntensity` exceeded the smoke threshold and frame
  report showed two textured smoke bursts with zero diagnostics. A fresh
  post-reload console check confirmed the old particle attachment mismatch logs
  are retained console history, not a current WebGPU failure.
- 2026-06-16: Typed generated signal subscriptions landed:
  `@aperture-engine/app/browser` now exposes `subscribeGeneratedSignals(...)`
  with unsubscribe semantics, and racing HUD uses it for lap timing and speed
  instead of polling generated diagnostic status each animation frame. Managed
  racing and Shadow Lab builds stayed healthy; a clean racing reload plus live
  input proof showed no fresh worker/render errors, and smoke particles reached
  hundreds of live textured emitters while input was held.
- 2026-06-16: Generated audio first-gesture startup was hardened in
  `@aperture-engine/audio`: snapshot-authored voices now track loop/one-shot
  intent while the backend is suspended, but buffer/stream sources do not start
  until the backend is running. Autoplay loops start after unlock, pre-unlock
  one-shot epochs are treated as stale and dropped, and running-context ducking
  still reacts to pending decode intent. Racing was relaunched through
  `pnpm exec aperture dev up --open --host 127.0.0.1 --port 5173` after
  clearing its Vite optimized cache; the fresh console had no new
  `AudioContext was not allowed to start` warning, and held input still rendered
  hundreds of textured smoke particles.

## Genericity Audit - 2026-06-16

This audit checks whether the library APIs already landed for the racing port
are broad Aperture V1 capabilities, not racing-only conveniences.

### Clear V1 Library Fits

- Math helpers: generic. Bevy exposes transform construction, look-at, axis, and
  matrix helpers on `Transform`; PlayCanvas exposes broad `Vec3`/math helpers.
  Aperture should keep these as shared, tested array-first helpers because every
  app needs the same quaternion/vector correctness.
- `defineResource(...)`, `resource.*`, and `this.resources`: generic. Bevy
  resources are the direct ECS-first precedent for one-per-world simulation
  state. Racing's `VehicleResource` is app-specific data, but the resource
  mechanism belongs in the library.
- `this.startOptions`: generic. Browser/app start parameters are a common
  runtime concern. The current filtering of engine-reserved fields is the right
  V1 boundary.
- `this.meshes.dynamic(...)`: generic. Runtime-authored mesh assets are needed
  for trails, debug geometry, procedural geometry, UI meshes, and editor tools.
  The helper keeps source mesh assets in the registry and GPU buffers in the
  renderer.
- `asset.texture(...)`, `decodeImageUrlToTextureSource(...)`, and texture
  validation: generic. PlayCanvas and Bevy both treat textures as engine asset
  concerns. Apps should not hand-roll image decode into renderer-independent
  texture source payloads.
- `asset.audio(...)` plus the main-thread sound board: generic. Bevy separates
  playback intent from sinks; PlayCanvas has sound components/slots. Aperture's
  split between worker-authored intent and browser-owned Web Audio nodes is the
  correct worker-boundary version of the same capability.
- `this.audio.loop/set/stop/playOneShot(...)`: generic. The racing RPM/skid
  model remains app code, but stable loop voices, one-shots, gain/rate/lowpass
  intent, and clip handles are library-level audio mechanics.
- `asset.particleEffect(...)`, `this.spawn.particles(...)`, and
  `this.particles.emit(...)`: generic. PlayCanvas exposes particle systems as a
  first-class component. Aperture's version keeps particle authoring
  renderer-independent and leaves simulation/render realization to the library.
- `this.trails.groundRibbon(...)`: generic enough for V1. It is a specific
  helper, but ground-conforming ribbon/trail meshes are common for skid marks,
  footprints, decals, paint strokes, path previews, and debug traces. It should
  stay parameterized and not mention racing.
- Built-in material `depthBias` render-state support: generic. Polygon offset is
  a standard render-state feature used by decals, trails, coplanar overlays,
  shadow tuning, and debug surfaces.
- `this.gltf.node(...)` / `this.gltf.nodes(...)`: generic. Imported GLTF scene
  hierarchy inspection is an engine facility. Filtering out primitive render
  children is important because the API promise is "authored GLTF nodes", not
  implementation details of Aperture's mesh-primitive replay.
- Spawn-time GLTF material overrides: generic enough. Render-state patching at
  spawn time is common for imported content policy, such as culling, shadow
  participation, or transparency. The current implementation clones source
  material assets and retargets spawned subtree entities instead of mutating
  shared imported assets globally.
- `this.spawn.gltfBatch(...)`: generic. Repeated scene/model instancing with
  shared material overrides, shadow flags, tags, and per-instance transforms is
  broadly useful for decoration fields, crowds, props, and level assembly.
- Fixed-step `RenderInterpolation` snapshot rewrite: generic. Bevy stores
  previous/current global transforms for renderable meshes in the render path;
  Aperture's worker-friendly equivalent is an opt-in presentation rewrite of the
  outgoing snapshot. The current hierarchy behavior is not a global smoothing
  hack: only opted-in local samples are blended, and descendants inherit those
  presentation matrices through ordinary transform composition.
- `createFollowCameraController(...)`: generic. Bevy's transform helpers and
  PlayCanvas camera component/controller patterns both support engine-level
  camera pose ownership instead of app-local repeated vector math. Aperture's
  helper stays input-agnostic and ECS-authoritative: apps provide target,
  optional lead velocity, and tuning, while the library writes ordinary camera
  `LocalTransform` and optional `RenderInterpolation`.
- Scene-pass render target format helpers: generic. HDR, post-processing, and
  offscreen render targets mean built-in scene helpers cannot assume the
  swapchain format. Centralizing scene-pass color format selection keeps
  particles, sprites, text, UI, skybox, and custom WGSL helpers aligned with the
  actual render pass.

### Acceptable But Needs V1 Tightening

- Generated browser signal readers: useful but incomplete. They solved racing
  HUD polling, but V1 should offer a deliberate browser subscription/event API
  rather than encouraging apps to poll generated status objects directly.
- `this.meshes.dynamic(...)`: keep, but add examples and diagnostics for update
  frequency, bounds correctness, and version churn. Dynamic mesh publication can
  become a performance trap without clear reports.
- Particle bursts: keep, but add public budget diagnostics and examples for
  burst overflow, emitter bounds, blend modes, and texture readiness.
- Ground ribbons: keep, but consider a more general `trail.ribbon(...)` family
  over time with world-space, screen-space, and surface-projected variants. Do
  not let the V1 API hard-code "drift mark" semantics.
- Sound board: keep as the browser-owned implementation layer, but the
  worker-facing `this.audio` API should remain the main app authoring path. Apps
  should rarely need to import the low-level sound board directly.
- GLTF material overrides: keep the current render-state patching. Do not expand
  it into arbitrary per-material shader mutation until custom material source
  contracts and validation cover that shape.
- `RenderInterpolation`: keep opt-in. Add a higher-level helper such as
  `enableRenderInterpolationSubtree(root, { authoredNodesOnly: true })` only if
  multiple apps need it; the core behavior should remain component-driven and
  presentation-only.

### Not Library Responsibilities

- Vehicle dynamics, lap rules, track cell data, spawn rules, racing audio RPM
  curves, and smoke art direction remain racing app code.
- The Shadow Lab camera radius fix is app harness cleanup, not a new library
  API. A reusable follow/orbit integration helper can still be added later, but
  the hard-coded compare radius was simply wrong for that experience.

### Next Actions From This Audit

- Finish RACE-LIB-20 with a reusable follow camera helper only if it remains
  input-agnostic, writes ordinary ECS `LocalTransform`, and keeps racing-specific
  tuning in racing.
- Add focused devtool/entity inspection coverage for GLTF primitive children so
  future agents can prove `this.gltf.nodes(...)` does not leak hidden render
  primitives in live apps.
- Add one particle rendering regression that drives a burst effect and asserts
  draw count or particle packet count, so "no particles visible" is caught
  without relying only on manual visual checks.
- Add a short docs page for fixed-step render interpolation explaining the
  hierarchy rule, opt-in boundaries, and why this stays a snapshot presentation
  rewrite instead of renderer-owned transform state.

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

Racing source currently has about 1,913 TypeScript lines under `src/`. The largest and most
engine-shaped files are:

- `src/systems/vehicle.system.ts`: 321 lines.
- `src/systems/setup.system.ts`: 217 lines.
- `src/lib/track-data.ts`: 184 lines.
- `src/lib/track-layout.ts`: 170 lines.
- `src/systems/audio.system.ts`: 157 lines.
- `src/systems/camera-follow.system.ts`: 133 lines.
- `src/lib/physics-colliders.ts`: 124 lines.
- `src/hud.ts`: 118 lines.
- `src/systems/lap-timer.system.ts`: 118 lines.
- `src/systems/drift-marks.system.ts`: 86 lines.
- `src/systems/particles.system.ts`: 65 lines.

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

Original evidence:

- Before the signal-reader slice, `hud.ts` and `audio.ts` read
  `readGeneratedBrowserAppStatus()` and dug into
  `status.lastWorkerSummary.signals` each animation frame.

Current status:

- `@aperture-engine/app/browser` now exposes `readGeneratedSignals()` and
  `subscribeGeneratedSignals(...)`.
- Racing HUD reads lap timing and speed through `subscribeGeneratedSignals(...)`
  instead of polling full generated diagnostics.
- Racing audio intent is worker-authored through `this.audio`, so it no longer
  has a browser-side status polling loop.

Current Aperture state:

- Worker signals exist and are still summarized through generated status for
  tooling.
- `readGeneratedSignals()` is the current app-facing pull path, and
  `subscribeGeneratedSignals(...)` is the current app-facing push path.

Library direction:

- Keep diagnostics status available, but app HUD/audio code should continue to
  avoid parsing it.
- Next audio work should tighten generated browser audio unlock behavior so
  worker-authored autoplay loops do not start Web Audio voices before the first
  user gesture, while still preserving queued loop intent after unlock and
  suppressing stale one-shots.

### 4. Audio Has A Good Low-Level Base But Missing Racing-Level Control

Original evidence:

- Before the RACE-LIB-18 audio slice, `audio.ts` built its own loop voices,
  gear/RPM model, lowpass filters, skid loop, impact one-shot, autoplay unlock,
  fetch/decode path, and RAF loop.
- That mixed racing-specific audio intent with reusable browser graph
  lifecycle, duplicating the kind of slot/source ownership PlayCanvas keeps in
  `SoundComponent`/`SoundComponentSystem`.

Current evidence:

- `racing/src/audio.ts` has been deleted.
- `racing/src/systems/audio.system.ts` owns the vehicle-specific RPM/skid/impact
  model as a worker system, reading `VehicleResource` and authoring
  `AudioEmitter` loop/one-shot intent through `this.audio`.
- Clip loading, decode/cache, `AudioContext` unlock, loop sources, one-shots,
  gain/playback-rate ramps, lowpass filters, mixer routing, and teardown are
  library-owned.

Current Aperture state:

- `@aperture-engine/audio` has a real main-thread audio engine, mixer, clip
  cache, voice manager, buses, diagnostics, and snapshot-driven
  `AudioEmitter`/`AudioListener` extraction.
- `@aperture-engine/audio` now also has a main-thread sound board API for
  imperative/live loop voices and one-shots when an app needs immediate
  browser-side control.
- Generated app config now exposes audio clip assets and generated audio
  enablement for config-authored clips.
- `@aperture-engine/app/systems` exposes a worker-safe `this.audio` control
  surface for stable loops, stop/set, and one-shot events.
- `AudioEmitter` packets carry `gain`, `timeScale`, loop, epochs, spatial
  settings, bus routing, authored lowpass cutoff/Q, and occlusion-compatible
  voice-manager filtering.
- Generated browser audio now keeps worker-authored playback intent separate
  from realized Web Audio sources while the backend is suspended. This matches
  Bevy's playback-intent/sink split and PlayCanvas' slot/autoplay behavior:
  intent can exist before playback is legal, but source nodes are started only
  when the audio backend is running.

Library direction:

- Keep ECS-authored audio intent as the primary path.
- Treat the sound board API as a pragmatic main-thread escape hatch.
- Continue hardening the snapshot-authored path toward richer worker-safe
  `AudioSink`/`AudioVoiceHandle` style controls: pause/resume, richer parameter
  automation descriptors, and reusable per-emitter or bus effect chains beyond
  the current lowpass fields.

### 5. Smoke Particles Were Implemented As Dynamic Meshes In App Code

Original evidence:

- Before the Phase 3 particle slices, `particles.system.ts` owned a particle
  pool, registered sampler/material/mesh handles, built camera-facing quads into
  a `MeshAsset`, and republished a dynamic mesh every frame.
- That path has been removed. `racing/src/systems/particles.system.ts` now reads
  `VehicleResource` and calls `this.particles.emit(...)`; texture sampling,
  billboard expansion, live burst state, and GPU buffer updates are library
  responsibilities.

Current Aperture state:

- Aperture has `ParticleEffectAsset`, `ParticleEmitter`, extraction, and a
  WebGPU particle frame path.
- The current WebGPU particle path now covers racing smoke: effect assets
  bind/sample texture/sampler dependencies, app systems can queue burst events
  through `this.particles.emit(...)`, and the WebGPU renderer owns the transient
  live particle state.

Library direction:

- Make the Aperture particle path production-usable for common billboard smoke.
- Continue hardening event/burst emission from worker systems.
- Support textured billboards, alpha blending, depth behavior, curves over
  lifetime, world-space simulation, and deterministic seeds.

### 6. Drift Marks Are A Trail/Ribbon Renderer In Disguise

Original evidence:

- `drift-marks.system.ts:19` ports the reference drift mark system as two
  dynamic vertex-colored triangle meshes.
- Before the ground-ribbon slice, app code manually owned typed vertex/index
  buffers, built `MeshAsset` descriptors, registered an unlit alpha material,
  spawned render entities, and republished dynamic mesh versions every frame.

Current Aperture state:

- App systems now expose `this.trails.groundRibbon(...)` for common
  vertex-colored ground ribbons. The helper owns mesh layout, bounds, index
  buffers, material registration, material depth bias, spawn handles, and
  version bumps.
- Racing drift marks use the trail helper and no longer construct raw mesh or
  material assets. The drift material requests `depthBias` through the library
  trail helper.

Library direction:

- Continue hardening `Trail`/`Ribbon` authoring primitives where other apps need
  trails, debug ribbons, editor handles, or ground decals.
- Continue replacing residual Y-offset decal habits with authored material
  render-state controls where visual parity allows it.

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

Current acceptance status:

- Done for the main-thread graph-ownership slice: `racing/src/audio.ts` shrank
  from 446 lines to 325 lines and no longer creates app-owned
  `AudioNode`/`AudioBufferSourceNode`/`AudioParam` objects.
- Gear/RPM pitch, engine lowpass, skid loop, and impact one-shot are all
  supported without app-created Web Audio nodes.
- Autoplay unlock and context lifecycle are owned by Aperture.
- Done for the worker-authored audio slice: `@aperture-engine/app/systems`
  exposes `this.audio`, `AudioEmitter` packets carry authored lowpass fields,
  `@aperture-engine/audio` composes authored lowpass with occlusion lowpass, and
  racing represents engine loops, skid loop, and impact one-shot as ECS/snapshot
  audio intent from `src/systems/audio.system.ts`.

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

Landed high-level path:

```ts
const trail = this.trails.groundRibbon("racing.driftMarks.bl", {
  material: "racing.driftMarks.material",
  width: 0.08,
  maxSegments: 4096,
  color: [0x11 / 255, 0x11 / 255, 0x11 / 255],
  opacity: 0.5,
  depthBias: -2,
});

trail.track(currentWheel, { emit, alpha });
trail.flush();
```

Possible future lower-level path:

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
- Render-state depth bias / polygon offset support now lives in material
  pipeline keys, WebGPU depth-stencil descriptors, and pipeline cache keys.
  The ground-ribbon helper exposes it for decal/trail-style geometry.

Acceptance criteria:

- `racing/src/systems/drift-marks.system.ts` no longer constructs raw
  `MeshAsset` descriptors or calls `assetsRegistry.markReady` per frame. Done
  2026-06-16.
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
  update. Done 2026-06-16.
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
- RACE-LIB-04: Add browser signal subscription/read API. Done for HUD signal
  snapshots via `readGeneratedSignals()` and `subscribeGeneratedSignals(...)`.
- RACE-LIB-05: Add public worker start options.

Racing migration:

- Delete `src/lib/math.ts`.
- Replace `vehicleState` module singleton with `VehicleStateResource`.
- Replace HUD/audio status parsing with signal subscriptions. HUD is migrated;
  audio now uses worker-authored intent instead of browser-side status polling.
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
- RACE-LIB-18: Add main-thread sound board escape hatch and remove raw Web
  Audio node ownership from racing audio. Done 2026-06-16.
- RACE-LIB-19: Add worker-authored audio control surface and migrate racing
  vehicle audio intent to ECS/snapshot audio. Done 2026-06-16.

Racing migration:

- Declare engine/skid/impact clips in `aperture.config.ts`.
- Remove manual Web Audio graph creation from `src/audio.ts`. Done
  2026-06-16.
- Move gear/RPM model into a worker system or resource-driven audio system.
  Done 2026-06-16.

Validation:

- Audio unit tests for loop speed/gain/filter snapshots.
- Browser test proves autoplay unlock and active voices.
- Manual racing check confirms engine pitch, skid loop, and impact one-shot.

### Phase 3: Texture Decode, Particles, Trails

Work items:

- RACE-LIB-09: Make config textures decode to real `TextureAsset` data.
- RACE-LIB-10: Finish textured billboard particle renderer. Done 2026-06-16.
- RACE-LIB-11: Add particle burst/event emission API. Done 2026-06-16.
- RACE-LIB-12: Add trail/ribbon or dynamic mesh builder. Done 2026-06-16.
- RACE-LIB-13: Wire material depth bias / polygon offset. Done 2026-06-16.

Racing migration:

- Replace `particles.system.ts` with a compact particle emitter/update system.
  Done 2026-06-16.
- Replace `drift-marks.system.ts` with trail/ribbon calls or dynamic mesh
  builder calls. Done 2026-06-16.
- Remove app image decode code.

Validation:

- WebGPU particle tests for textured alpha billboard output.
- Dynamic trail tests for bounds/version updates and authored material depth
  bias.
- Racing drift visual check for smoke and tire marks.

### Phase 4: GLTF Spawn Ergonomics And Material Overrides

Work items:

- RACE-LIB-14: Add GLTF instance node lookup helper. Done 2026-06-16.
- RACE-LIB-15: Add spawn-time material/render-state overrides. Done
  2026-06-16.
- RACE-LIB-16: Add batch/instanced spawn helper if decoration count remains
  noisy after lookup/override work. Done 2026-06-16.

Racing migration:

- Replace vehicle child-node scanning with instance lookup. Done 2026-06-16.
- Replace global material registry patching with spawn overrides or imported
  material defaults. Done 2026-06-16.
- Simplify decoration spawning if a batch helper lands. Done 2026-06-16.

Validation:

- GLTF lookup tests for named node success, missing node, duplicate node, and
  raw GLTF replay `Parent` fallback. Done 2026-06-16.
- Material override tests through render extraction. Done 2026-06-16.
- Racing/shadow-lab typecheck/build, no-cache live source probes, and racing
  MCP runtime screenshot/status check. Done 2026-06-16.
- Batch GLTF spawn test proving shared options, per-instance transforms, and
  ordinary ECS subtree output. Done 2026-06-16.

### Phase 5: Racing Source Cleanup

Work:

- Remove inactive `setup.system.ts.*` files or move them to a clearly ignored
  archive outside active system globs. Done 2026-06-16.
- Remove stale bisect comments and unused-import `void` lines.
  Done 2026-06-16 for the active decoration placeholder imports and deleted
  setup scaffolds.
- Split `track.ts` into:
  - `track-data.ts`
  - `track-codec.ts`
  - `track-layout.ts`
  - `track-runtime.ts`
    Done 2026-06-16 for racing while preserving `track.ts` as a compatibility
    barrel.
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
- `src/audio.ts`: deleted by RACE-LIB-19 after audio intent moved to
  worker-authored ECS/snapshot state.
- `src/systems/audio.system.ts`: owns only racing-specific RPM/skid/impact
  tuning while using Aperture's worker-safe audio control surface.
- `src/systems/particles.system.ts`: reduced from 537 lines to emitter config
  and wheel-emission logic.
- `src/systems/drift-marks.system.ts`: reduced from 292 lines to trail setup
  and wheel segment emission.
- `src/systems/vehicle.system.ts`: smaller child lookup and transform writes.
- `src/hud.ts`: no generated-status parsing.
- `src/lib/track.ts`: split by responsibility. Done 2026-06-16.

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

Continue the source-readability/library-gap work with RACE-LIB-20:

1. Add a small app-level camera follow/control helper that packages the
   reusable lead/deadzone/smoothing/look-at transform work currently open-coded
   in `src/systems/camera-follow.system.ts`.
2. Keep racing-specific tuning in `src/lib/tuning.ts`, but move the generic
   camera basis, exponential smoothing, deadzone clamp, and transform writeback
   into the Aperture system API or a focused helper module.
3. Migrate racing camera follow to the helper without changing the camera feel.
4. Validate with focused helper tests, racing typecheck/build, cache-busted
   served-module probes, and Aperture MCP runtime status/visual checks.

Reason:

- RACE-LIB-19 finishes the audio intent migration, so the next largest
  readability win is the camera-follow system's low-level vector math and
  transform mutation.
- A focused helper keeps Aperture's API ergonomic for camera-driven experiences
  without moving racing-specific game rules into the library.
