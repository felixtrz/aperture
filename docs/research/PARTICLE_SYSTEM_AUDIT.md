# Particle System Audit

This note records a full particle-system audit for Aperture's current V1 path.
It is a planning artifact only; it does not introduce runtime source changes.

The audit was triggered by the racing smoke work. Racing now uses shared
particle APIs instead of app-owned billboard meshes, but the particle system
still needs stronger generic behavior, diagnostics, and proof routes before it
is ready to be treated as a V1 engine feature.

## Scope

The audit covers:

- Particle effect asset authoring and validation.
- ECS particle emitter components and app-facing particle APIs.
- Worker-authored burst events.
- Render extraction for persistent emitters and transient bursts.
- WebGPU particle resource lifetime, simulation, and billboard rendering.
- Browser/runtime diagnostics for the racing app.
- Reference comparison against PlayCanvas, Bevy, and three.quarks.

The audit does not cover unrelated sprite, UI, text, or material pipelines
except where they directly affect particle rendering.

## Current Aperture Source Anchors

Representative Aperture files inspected:

- `packages/render/src/assets/particles.ts`
- `packages/render/src/rendering/authoring-components-core.ts`
- `packages/render/src/rendering/authoring-create-particles.ts`
- `packages/render/src/rendering/extraction-particles.ts`
- `packages/render/src/rendering/particle-burst-queue.ts`
- `packages/app/src/systems/particles.ts`
- `packages/app/src/worker/snapshot.ts`
- `packages/cli/src/tools/render.ts`
- `packages/webgpu/src/app/particles.ts`
- `packages/webgpu/src/render/particles/particle-pipeline.ts`
- `examples/gpu-particles.ts`
- `examples/content-showcase.ts`
- `test/app/particle-effect-assets.test.ts`
- `test/app/particle-spawn.test.ts`
- `test/rendering/particle-emitter-extraction.test.ts`
- `test/webgpu/particle-frame-resources.test.ts`
- `test/webgpu/particle-pipeline.test.ts`
- `racing/aperture.config.ts`
- `racing/src/systems/particles.system.ts`
- `racing/test/racing/particles-system.test.ts`

## Reference Engine Source Anchors

### PlayCanvas

Representative files inspected:

- `references/engine/src/framework/components/particle-system/component.js`
- `references/engine/src/framework/components/particle-system/system.js`
- `references/engine/src/framework/components/particle-system/data.js`
- `references/engine/src/scene/particle-system/particle-emitter.js`

Findings:

- PlayCanvas exposes a first-class `particlesystem` component. Apps author
  particle behavior as engine component data rather than manually managing
  live particles.
- The component surface is broad: particle count, lifetime, emission rate,
  bursts, looping, prewarm, local/world space, emitter shapes, velocity curves,
  color/alpha/scale/rotation curves, sprite-sheet animation, render layers,
  blend mode, depth write, lighting, stretch, align-to-motion, sorting, soft
  particles, wrapping, and mesh/normal-map inputs.
- PlayCanvas simulation uses a fixed timestep with substeps. The component
  system accumulates frame delta, clamps substeps, and advances the emitter in
  stable increments.
- PlayCanvas computes particle bounds from emitter shape, scale, velocity,
  radial speed, local velocity, lifetime, and particle size. The app can still
  influence behavior, but it is not required to guess a bounding sphere for
  normal cases.
- Sorting and some renderer features force CPU paths. This is an important
  product lesson: advanced particle features need explicit capability and
  performance policy, not silent partial behavior.
- Soft particles are modeled as a renderer feature that depends on scene depth.
- Lifecycle is explicit: play, pause, unpause, stop, reset, auto play, and
  is-playing state are part of the component model.

### Bevy

Representative files inspected:

- `references/bevy/crates/bevy_sprite/src/sprite.rs`
- `references/bevy/crates/bevy_sprite/src/sprite_mesh.rs`
- `references/bevy/crates/bevy_sprite/src/lib.rs`
- `references/bevy/crates/bevy_render/src/extract_instances.rs`
- `references/bevy/crates/bevy_material/src/alpha.rs`
- `references/bevy/examples/animation/animated_mesh_events.rs`
- `references/bevy/crates/bevy_anti_alias/src/taa/mod.rs`

Findings:

- The inspected Bevy checkout does not provide a PlayCanvas-style built-in
  general particle engine. Bevy's value here is architectural rather than
  feature-surface parity.
- Bevy keeps renderable intent in ECS components and asset handles. Rendering
  consumes extracted render data rather than mutating app-side render objects.
- Sprite bounds are system-derived from image or mesh data, with opt-outs for
  cases where frustum culling is undesirable. This supports Aperture moving
  common particle bounds out of app code.
- Visibility and extraction are explicit. Bevy can extract only visible
  instances, which matches Aperture's render-extraction boundary direction.
- Alpha mode is an explicit material/render concern, with opaque, mask, blend,
  premultiplied, alpha-to-coverage, additive, and multiply-style modes.
- Bevy's TAA notes call out alpha-blended particles as a special case: they
  either need motion-vector support or should be rendered after TAA. Aperture
  should capture this in its future render-graph/post-processing policy.
- Bevy examples often implement simple particles as normal ECS entities with
  timers, transforms, meshes, and materials. That is useful for flexibility, but
  Aperture should not require racing-style smoke to be hand-authored at that
  level.

### three.quarks

Representative files inspected:

- `references/three.quarks/packages/quarks.core/src/IParticleSystem.ts`
- `references/three.quarks/packages/quarks.core/src/Particle.ts`
- `references/three.quarks/packages/quarks.core/src/behaviors/Behavior.ts`
- `references/three.quarks/packages/quarks.core/src/behaviors/ColorOverLife.ts`
- `references/three.quarks/packages/quarks.core/src/behaviors/EmitSubParticleSystem.ts`
- `references/three.quarks/packages/three.quarks/src/ParticleSystem.ts`
- `references/three.quarks/packages/three.quarks/src/ParticleEmitter.ts`
- `references/three.quarks/packages/three.quarks/src/BatchedRenderer.ts`
- `references/three.quarks/packages/three.quarks/src/BatchedParticleRenderer.ts`
- `references/three.quarks/packages/three.quarks/src/SpriteBatch.ts`
- `references/three.quarks/packages/three.quarks/src/VFXBatch.ts`

Findings:

- three.quarks is a strong authoring vocabulary reference, but it is not the
  runtime architecture Aperture should copy. Its implementation is built around
  three.js `Object3D` state and JS particle objects.
- The authoring model includes looping, prewarm, duration, shape, start life,
  start speed, start rotation, start size/length/color, emission over time,
  emission over distance, bursts, render mode, material, layers, texture-sheet
  tiles, soft particles, render order, world/local space, and behavior lists.
- Behaviors cover common VFX vocabulary: force, gravity, noise/turbulence,
  color/size/speed/rotation over life, frame over life, orbit, sub-emission,
  and related modules.
- Render modes include billboard, stretched billboard, mesh, trail, horizontal
  billboard, and vertical billboard.
- Batching groups systems by render settings such as material, blend mode,
  texture, tile settings, soft-particle state, depth behavior, render mode,
  layers, render order, and geometry.
- Lifecycle APIs include play, pause, stop, restart, end emit, clone, emit, and
  events for emit end, destroy, and particle death.

## Current Aperture Design

### Asset Authoring

`createParticleEffectAsset` defines config-authored particle effects with:

- `capacity`
- `duration`
- `looping`
- `prewarm`
- `emissionRate`
- `bursts`
- `lifetime`
- `startSpeed`
- `startSize`
- `startColor`
- `endColor`
- `gravity`
- `blendMode`
- `texture`
- `sampler`
- `atlasFrameCount`
- `sizeOverLifetime`
- `colorOverLifetime`
- `curveSampleCount`

The validator rejects invalid capacities, durations, rates, ranges, atlas frame
counts, curve sample counts, and malformed curve/gradient inputs. Texture and
sampler handles are reported as particle-effect dependencies.

This is a good ECS/asset boundary. The primary issue is that the public schema
is ahead of what the WebGPU runtime actually executes. In particular,
`emissionRate`, `bursts`, `duration`, `looping`, `prewarm`,
`atlasFrameCount`, and several range fields are not implemented as a complete
authored particle simulation.

### ECS Components

The `ParticleEmitter` ECS component owns:

- `effectId`
- `capacity`
- `seed`
- `resetEpoch`
- `timeScale`
- `simulationSpace`
- `boundsCenter`
- `boundsRadius`
- `visible`

This matches the intended Aperture architecture: ECS owns emitter intent,
resource handles, seeds, playback controls, visibility, and bounds; WebGPU owns
live particle buffers. No live particle objects are stored in ECS snapshots.

`boundsRadius: 0` now selects the automatic path. PlayCanvas and Bevy both
suggest that common bounds should be renderer/system-derived, with manual
overrides reserved for unusual effects or performance tuning.

### App API

`ParticleAccess` exposes:

- `effect(id)` for resolving an effect handle from app systems.
- `emit(effect, options)` for transient worker-authored burst requests.
- `summary()` for a compact queue summary.

`ParticleEmitOptions` currently include:

- `count`
- `position`
- `positionJitter`
- `velocity`
- `seed`
- `timeScale`
- `layerMask`
- `boundsCenter`
- `boundsRadius`

This is the right direction for racing: the app says "emit smoke here" and does
not build dynamic meshes or billboard geometry. The default automatic bounds
path means normal smoke no longer needs an app-authored radius. The current API
is still burst-only and lacks lifecycle controls for persistent emitters.

### Extraction

Persistent emitters are extracted from ECS by `extractParticleEmitters`. The
extractor filters disabled, invisible, missing-transform, missing-effect,
not-ready-effect, invalid-effect, layer-mismatched, and frustum-culled emitters.
It produces flat `ParticleEmitterPacket` data for the renderer.

Transient bursts are drained from `ParticleBurstQueue` and converted into
synthetic burst packets. Each burst packet has a stable synthetic render id,
capacity equal to request count, start frame, seed, origin, jitter, velocity,
effect handle, bounds, and layer mask.

This preserves the render-extraction boundary. Recent proof tooling now exposes
compact queue and renderer-owned live particle counts, which makes the common
"not emitting" versus "rendered but visually hidden" distinction testable. The
remaining gap is feature completeness: some fields accepted by the public schema
are deliberately reported as deferred V1 semantics until the runtime executes
them.

### WebGPU Simulation And Rendering

The WebGPU particle path has two modes:

- Persistent emitters use a compute shader and renderer-owned persistent GPU
  buffers.
- Burst emitters use renderer-owned CPU arrays that are advanced by the WebGPU
  app layer and uploaded to a storage buffer.

The render path draws camera-facing instanced billboards, samples an optional
texture, applies color over lifetime, and supports blend modes currently used
by the examples and racing.

This is enough to prove textured smoke bursts and simple GPU particle examples.
It is not yet a complete generic particle engine:

- The persistent compute shader is closer to a demo effect than a full executor
  for `ParticleEffectAssetInput`.
- Continuous particles spawn in a simplified plane and do not model general 3D
  emitter shapes.
- Burst simulation is CPU-side in the renderer thread, which is acceptable as a
  bridge for racing smoke but not the long-term default.
- Per-emitter compute dispatch is simple but not efficient for many emitters.
- Atlas frame selection is in the asset schema but not implemented in the
  particle render shader.
- Per-particle alpha sorting, soft particles, trails, mesh particles,
  sub-emission, lit particles, and motion vectors remain future work.

### Tooling And Runtime Visibility

`render_get_frame_report` can expose renderer particle counts such as emitter
count, live particle count, textured emitter count, state reuse, and dispatches.
That is useful after particles reach the renderer.

The worker snapshot and independent particle-bursts route now expose compact
particle queue summaries, while renderer frame reports expose live textured
particle counts. This is enough for routine MCP/Playwright proofs without
dumping broad ECS state.

During this audit, the managed racing session was healthy:

- App status: running.
- WebGPU status: OK.
- Assets: smoke texture and smoke particle effect ready.
- Latest idle frame: zero particle emitters and zero live particles because the
  car was not drifting at that moment.
- Console: no fresh particle-specific WebGPU errors were present in the current
  session. The alarming console history included older stale worker/render
  errors retained in append-only logs.

The idle frame is not proof of a particle bug. Racing smoke still depends on
vehicle drift for the in-game effect, but the independent particle-bursts route
and managed Aperture ECS stepping make the production particle path
deterministically provable.

## Reference Comparison

| Capability                   | Aperture today                                                      | PlayCanvas                                     | Bevy                                     | three.quarks                        |
| ---------------------------- | ------------------------------------------------------------------- | ---------------------------------------------- | ---------------------------------------- | ----------------------------------- |
| ECS/source-of-truth boundary | Strong                                                              | Component/entity model, but scene-object based | Strong ECS/extraction model              | three.js object model               |
| Config particle asset        | Partial                                                             | Broad component data                           | Not built-in as a generic particle asset | Broad parameters/behaviors          |
| Worker-authored bursts       | Present                                                             | Engine component API, not this exact model     | ECS events/systems are idiomatic         | `emit` APIs                         |
| Persistent emitter lifecycle | Minimal reset/time scale                                            | play/pause/stop/reset/autoPlay                 | Would be ECS/system authored             | play/pause/stop/restart/endEmit     |
| Fixed-step simulation policy | Not unified for particles                                           | Explicit fixed timestep/substeps               | FixedUpdate exists generally             | Runtime update loop                 |
| Automatic bounds             | Common burst/continuous bounds derived, explicit overrides retained | Strong computed bounds                         | Sprite/mesh bounds system-derived        | Has renderer/system bounds concepts |
| GPU live buffers             | Present for persistent emitters                                     | GPU path with CPU fallback/capability policy   | Renderer-owned resources                 | Batched dynamic render buffers      |
| Burst simulation path        | Renderer CPU arrays                                                 | Engine emitter path                            | App/system dependent                     | JS particle objects                 |
| Texture sampling             | Present                                                             | Present                                        | Sprite/material texture handles          | Present                             |
| Sprite-sheet animation       | Schema only                                                         | Present                                        | Sprite atlas support elsewhere           | Present                             |
| Soft particles               | Missing                                                             | Present                                        | Render-graph/material concern            | Present                             |
| Per-particle sorting         | Deferred/missing                                                    | Present with CPU constraints                   | Renderer/material concern                | Present by renderer path            |
| Trails/mesh particles        | Missing                                                             | Mesh particles present                         | Mesh entities possible                   | Present                             |
| Sub-emission/behaviors       | Missing                                                             | Curves and behavior-like fields                | User systems/plugins                     | Present                             |
| Tooling diagnostics          | Partial                                                             | Mature engine state/stats                      | ECS tooling friendly                     | Runtime events/stats                |

## Severity-Ranked Findings

### P0: There Is No Standalone Production Burst Proof

Status: done for the current V1 burst path.

Racing smoke now uses the shared particle path, and
`examples/particle-bursts.html` proves `this.particles.emit(...)` independently
of racing vehicle drift. This keeps regression checks from depending on an
interactive driving state where an idle frame can honestly report zero live
particles.

Completed fix:

- Add a small production example or route that declares a texture and particle
  effect through config assets.
- Emit textured bursts from a worker system through `this.particles.emit(...)`.
- Prove nonzero live textured particles, draw submission, and alpha/depth
  composition through MCP/Playwright without vehicle input.

### P0: Particle Diagnostics Are Too Thin

Status: largely addressed for burst visibility and schema truthfulness; still a
watch area as new particle semantics land.

The renderer can report live particle counts after extraction succeeds, and
worker summaries now expose burst queue counters. The remaining diagnostics
need to grow with each deferred particle semantic rather than silently accepting
unsupported authored data.

Missing distinctions:

- No app emission occurred.
- Burst requests are pending.
- Burst queue overflow dropped requests.
- Effect handle is unknown.
- Effect asset is not ready.
- Effect asset is invalid.
- Emitter or burst was culled by bounds/layers.
- Renderer created state but drew zero live particles.
- Renderer drew particles without a texture.

Completed and remaining fix:

- Compact worker particle summaries are now available to generated snapshots
  and MCP-facing reports.
- Particle frame reports expose live renderer-owned particle counts.
- Future work should extend readiness/skip counters as emitter lifecycle,
  sprite-sheet animation, sorting, soft particles, and GPU burst execution land.

### P1: The Public Effect Schema Is Ahead Of Runtime Behavior

`ParticleEffectAssetInput` exposes fields that imply a broader engine than the
runtime currently implements. This is dangerous for V1 because users and agents
will assume fields are honored if validation accepts them.

Examples:

- `atlasFrameCount` exists, but particle sprite-sheet rendering is not wired.
- `emissionRate`, `duration`, `looping`, `prewarm`, and `bursts` are not a
  complete persistent-emitter execution model.
- `startSpeed.min` and `lifetime.min` are not consistently meaningful across
  paths.
- Persistent GPU particles use a simplified procedural spawn pattern rather
  than authored shape/velocity/lifetime semantics.

Required fix:

- The first truthful-schema slice is now implemented:
  `ParticleEffectAsset.runtimeFeatures`, generated worker asset summaries, and
  the `particle-bursts` example status report supported, partially supported,
  and unsupported fields with structured diagnostics.
- Remaining work is semantic, not visibility-related: implement deferred fields
  only when they can be mapped cleanly to the runtime, and keep unsupported
  fields explicit until then.

### P1: Burst Simulation Works But Is Not The Long-Term Engine Path

Renderer-owned CPU burst simulation was a pragmatic way to remove racing's
app-owned dynamic smoke mesh. It keeps live particles out of ECS, which is
good, but it is not the right default for a scalable WebGPU-only engine.

Risks:

- CPU work scales with live particles on the renderer thread.
- It is separate from the persistent GPU simulation path.
- It increases the chance of feature divergence between bursts and continuous
  emitters.
- It complicates future worker-thread simulation and deterministic replay
  expectations.

Required fix:

- Treat CPU burst simulation as a compatibility bridge.
- Move burst spawning into the GPU particle state model or a unified particle
  simulation backend.
- Keep a capability fallback only if it is intentionally documented and
  reported.

### P1: Bounds Should Be Derived For Common Effects

Status: done for common V1 burst and continuous billboard effects.

Particles no longer require app-authored bounding spheres for common effects.
`boundsRadius: 0` is the automatic default, and racing smoke no longer supplies
an app-level radius.

Reference lesson:

- PlayCanvas estimates local/world bounds from emitter shape, particle size,
  lifetime, and velocity curves.
- Bevy derives sprite/mesh bounds through systems and lets users opt out when
  needed.

Completed fix:

- Compute conservative default bounds from effect descriptor and emission
  request, including size, lifetime, speed, gravity, burst position jitter,
  authored burst velocity, and emitter transform scale.
- Preserve manual bounds as an override for unusual effects.
- Emit diagnostics when an effect cannot be bounded conservatively.

### P1: Lifecycle Controls Are Incomplete

Persistent emitters have seed, reset epoch, time scale, visibility, and
simulation space, but not a full lifecycle model.

Missing controls:

- play
- pause
- stop
- restart
- end emit
- auto destroy
- auto play
- prewarm as runtime behavior

Required fix:

- Add a small lifecycle state to `ParticleEmitter`.
- Make extraction/rendering honor it.
- Mirror common PlayCanvas/three.quarks semantics where they fit Aperture's ECS
  model.

### P1: The Continuous GPU Shader Is Not A General 3D Particle Executor

The compute shader proves persistent GPU buffers, deterministic hashing, curve
sampling, and billboard rendering. It does not yet execute a full authored VFX
description.

Missing basics:

- Emitter shapes.
- Directional or volume spawn.
- General 3D initial velocity.
- Start speed ranges.
- Lifetime ranges.
- Burst schedules.
- Loop/prewarm semantics.
- Local-space simulation semantics beyond transform-origin placement.

Required fix:

- Define a V1 GPU particle parameter layout that maps directly from
  `ParticleEffectAssetInput`.
- Add a compatibility test that asserts each accepted V1 field changes output
  or is reported unsupported.

### P1: Sprite-Sheet Fields Are Not Implemented

The asset schema exposes `atlasFrameCount`, but particle rendering samples the
whole texture as a single frame.

Required fix:

- Add tile count/frame selection data to particle packets and render uniforms.
- Implement frame over life or start frame at minimum.
- Add tests using a small diagnostic atlas where sampled colors prove tile
  selection.

### P2: Render Feature Coverage Is Narrow

The current renderer covers camera-facing textured billboards with basic blend
modes. That is enough for smoke, sparks, and simple effects, but not enough for
common production VFX.

Missing or deferred:

- Soft particles/depth fade.
- Stretched billboards.
- Horizontal/vertical billboard modes.
- Mesh particles.
- Trails.
- Lit particles or particle normal maps.
- Premultiplied alpha and alpha-to-coverage policy.
- Per-particle sorting or documented sort limits.
- Motion-vector/post-processing policy.

Required fix:

- Add these as explicit roadmap items with capability flags.
- Avoid silently accepting authoring choices that depend on missing features.

### P2: Batching And Dispatch Strategy Are Early-Stage

The current WebGPU path submits simple per-emitter work. That is acceptable for
proofs, but it does not match PlayCanvas or three.quarks batching maturity.

Required fix:

- Batch compatible particle systems by render settings and effect layout.
- Reduce per-emitter compute pass overhead where possible.
- Track aggregate particle budgets and GPU buffer usage in frame reports.

### P2: Test Coverage Is Good Internally But Weak At The App Boundary

There are useful focused tests for assets, app spawn APIs, extraction, WebGPU
resources, and pipeline descriptors. The missing piece is a deterministic
end-to-end app proof for worker-authored burst particles.

Required fix:

- Add an app/system-level route and test that does not depend on racing drift.
- Keep a separate racing test to prove the real smoke system still emits when
  vehicle state crosses the drift threshold.

## Genericity Audit Of Recently Landed Particle Work

The recently landed pieces are broadly generic enough to belong in Aperture:

- `asset.particleEffect(...)` is a reusable config-asset concept and matches
  PlayCanvas's first-class particle component direction.
- `this.spawn.particles(...)` is a generic ECS authoring helper for persistent
  emitters.
- `this.particles.emit(...)` is a generic worker-authored burst event API.
- Textured billboard particle rendering is a common VFX baseline, not
  racing-specific.
- Render-extracted burst packets preserve the Aperture rule that ECS and worker
  systems do not own live renderer buffers.

The parts that need tightening before V1:

- Manual bounds in racing should become an override, not the common path.
- Burst CPU simulation should be treated as a bridge, not the final engine
  architecture.
- Public asset fields are now diagnosed through runtime feature reports, but
  deferred fields still need real semantics before they can move out of the
  unsupported or partially-supported buckets.
- Tooling must make particle readiness and budget state visible without full
  entity dumps.

## Recommended V1 Implementation Slices

### Slice 1: Particle Proof Route And Diagnostics

Status: implemented 2026-06-16.

Goal:

Add a deterministic production particle proof route plus compact diagnostics
that make "no particles visible" actionable.

Implementation:

- Add a small app/example route that uses config `asset.texture(...)`,
  `asset.particleEffect(...)`, and a worker system calling
  `this.particles.emit(...)`.
- Add worker summary output for `this.particles.summary()`.
- Extend frame reports with particle readiness/skip counters.
- Add an MCP or Playwright proof that verifies nonzero live textured particles,
  draw submission, no particle diagnostics, and non-clear pixels.
- Keep racing smoke verification as a separate check, not the only proof.

Acceptance criteria:

- The proof route reports nonzero live textured particles without user input.
- The proof route can distinguish no emission, pending bursts, dropped bursts,
  effect-not-ready, and renderer-live states.
- Racing still reports textured smoke when a deterministic driving/drift setup
  triggers emissions.

Reference anchors:

- PlayCanvas `references/engine/src/framework/components/particle-system/component.js`
- PlayCanvas `references/engine/src/framework/components/particle-system/system.js`
- Bevy `references/bevy/crates/bevy_render/src/extract_instances.rs`

### Slice 2: Truthful V1 Particle Schema

Status: implemented as runtime feature reporting 2026-06-16. Deferred particle
semantics remain explicit unsupported or partially-supported diagnostics until
they are implemented.

Goal:

Make every accepted particle asset field either work or produce a clear
unsupported-feature diagnostic.

Implementation:

- Audit all fields of `ParticleEffectAssetInput`.
- Add tests that exercise each accepted field.
- Implement low-risk missing fields first: atlas frame count, lifetime range,
  start speed range, burst schedule basics.
- Add diagnostics for deferred fields such as trails, soft particles, mesh
  particles, and advanced behavior modules.

Acceptance criteria:

- A user cannot configure a field that is silently ignored.
- Tests prove implemented fields change renderer packets or frame output.
- Diagnostics catalog documents unsupported particle features.

Reference anchors:

- three.quarks `references/three.quarks/packages/quarks.core/src/IParticleSystem.ts`
- PlayCanvas `references/engine/src/scene/particle-system/particle-emitter.js`

### Slice 3: Automatic Particle Bounds

Status: recommended next slice.

Goal:

Remove normal-case bounding guesswork from app code.

Implementation:

- Derive conservative bounds from effect size, lifetime, speed, gravity,
  position jitter, velocity, and emitter transform.
- Keep `boundsRadius` and `boundsCenter` as overrides.
- Add extraction diagnostics when derived bounds are impossible or unusually
  large.
- Update racing to rely on derived bounds unless its smoke needs a deliberate
  override.

Acceptance criteria:

- Simple burst and continuous effects render without app-supplied bounds.
- Frustum culling still removes off-screen effects.
- Racing smoke remains visible with the automatic path.

Reference anchors:

- PlayCanvas `references/engine/src/scene/particle-system/particle-emitter.js`
- Bevy `references/bevy/crates/bevy_sprite/src/lib.rs`

### Slice 4: Unified GPU Particle Execution

Goal:

Move persistent and burst particles toward one GPU-owned simulation model.

Implementation:

- Define a compact GPU emitter parameter layout for V1 effect semantics.
- Represent burst requests as GPU spawn commands or a GPU-consumed spawn buffer.
- Preserve deterministic seed behavior.
- Keep live particles renderer-owned and out of ECS snapshots.
- Reduce per-emitter dispatch/submission overhead.

Acceptance criteria:

- Burst and continuous effects share the same simulation semantics.
- CPU-side renderer burst arrays are removed or explicitly relegated to a
  documented fallback.
- Particle frame reports include aggregate budget and buffer usage.

Reference anchors:

- PlayCanvas `references/engine/src/scene/particle-system/particle-emitter.js`
- three.quarks `references/three.quarks/packages/three.quarks/src/BatchedParticleRenderer.ts`

### Slice 5: Lifecycle And Fixed-Step Policy

Goal:

Make persistent emitters predictable and controllable.

Implementation:

- Add lifecycle state to `ParticleEmitter`.
- Implement play, pause, stop, restart, end emit, auto play, and prewarm.
- Decide whether particle simulation uses render-frame delta, fixed-step
  accumulation, or effect-specific stepping. Document the policy.
- Add tests for reset epoch, pause, restart, and prewarm.

Acceptance criteria:

- Persistent emitters can be controlled without recreating entities.
- Prewarm is visible and deterministic.
- Fixed-step or variable-step behavior is documented and test-covered.

Reference anchors:

- PlayCanvas `references/engine/src/framework/components/particle-system/system.js`
- three.quarks `references/three.quarks/packages/quarks.core/src/IParticleSystem.ts`

### Slice 6: Render Feature Roadmap

Goal:

Plan advanced production features without overloading the immediate V1 path.

Implementation:

- Add capability flags and diagnostics for soft particles, sorting, trails,
  mesh particles, stretched billboards, sprite-sheet animation, and lit
  particles.
- Implement sprite-sheet animation before trails/mesh particles because the
  schema already exposes atlas state.
- Decide render-graph placement for alpha-blended particles relative to TAA and
  post-processing.

Acceptance criteria:

- Deferred features are explicit in diagnostics and docs.
- V1 features remain small, truthful, and verified.

Reference anchors:

- PlayCanvas `references/engine/src/framework/components/particle-system/component.js`
- Bevy `references/bevy/crates/bevy_anti_alias/src/taa/mod.rs`
- three.quarks `references/three.quarks/packages/quarks.core/src/behaviors/Behavior.ts`

## Recommended Next Task

Slice 1 is implemented: `examples/particle-bursts.html` now proves the shared
worker-authored burst path independently of racing vehicle input, worker
snapshots expose particle queue summaries, and focused browser coverage verifies
live textured particles, draw submission, zero particle diagnostics, and no
queue drops or rejections.

Implement Slice 2 next.

This is now the highest-leverage step because the proof route makes particle
regressions measurable. The remaining V1 risk is that accepted particle asset
fields may imply behavior the renderer does not actually execute. Aperture
should keep the public V1 surface small and truthful: each accepted field should
either affect packets/frame output or produce an explicit unsupported-feature
diagnostic.

Proposed task text:

> Make the V1 particle asset schema truthful. Audit every accepted
> `ParticleEffectAssetInput` field, implement the low-risk missing fields that
> map cleanly to current extraction/WebGPU execution, and add structured
> unsupported-feature diagnostics for deferred fields. Focused tests must prove
> every accepted V1 field either changes renderer packets or frame output, or
> reports a documented unsupported feature. Re-run the independent particle
> proof route, managed racing smoke proof, and Shadow Lab health checks after
> the slice.

## Non-Goals For The Next Slice

Do not implement the full PlayCanvas or three.quarks feature surface in the
next slice. In particular, do not start with trails, mesh particles,
sub-emission, soft particles, or per-particle sorting.

Do not copy three.quarks runtime architecture. Use it for authoring vocabulary
only. Aperture should keep ECS intent, flat extraction packets, and
renderer-owned live particle buffers.

Do not move live particles into ECS. That would violate the current North Star
and make future worker simulation harder.

## Bottom Line

Aperture's particle architecture is pointed in the right direction: ECS and app
systems author intent, render extraction creates flat packets, and WebGPU owns
live particle state. Racing's current code is no longer the main problem; it is
thin enough to be a normal app-level smoke trigger.

The V1 risk is that the shared particle feature is only partially implemented
and not yet easy to prove. The next work should make particles observable,
diagnosable, and independently testable before expanding the feature surface.
