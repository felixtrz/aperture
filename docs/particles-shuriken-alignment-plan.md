# Shuriken-Aligned Particle System Plan

## Summary

Replace Aperture's current flat particle effect API with a clean-break, Unity
Shuriken-style module schema. The runtime remains Aperture-native: ECS owns
emitter intent, snapshots carry serializable intent, and WebGPU owns derived
particle buffers.

The target is phased: first fix correctness and introduce the schema, then
implement a high-quality Shuriken subset, then expand to three.quarks parity
plus Aperture-specific essentials. Unity/three.quarks importers are not
implemented in this plan, but the schema and diagnostics must be importer-ready.

## Phase 1: Foundation And Breaking API

### Key Changes

- Introduce `version: 2` particle effect assets with canonical Shuriken-style
  modules: `main`, `emission`, `shape`, `renderer`, `colorOverLifetime`,
  `sizeOverLifetime`, etc.
- Remove old flat public fields from `asset.particleEffect(...)`; reject them
  with actionable migration diagnostics.
- Add Aperture-native serializable value types for scalar, color, and vec3
  values: constant, random-between constants, curve/gradient, and
  random-between curves/gradients.
- Normalize module defaults into renderer-ready packed data.
- Fix current correctness blockers: continuous emitter Z placement, global
  transparent sorting integration, and culling destroying particle state.

### Acceptance Criteria

- Old flat particle fields fail validation with clear migration messages.
- New module schema validates and produces stable normalized defaults.
- Existing examples are migrated to the new schema.
- Particle emitters at non-zero Z render at the correct world depth.
- Particle draw commands participate in global transparent ordering.
- Offscreen continuous emitters do not lose derived simulation state solely
  because they were culled.

### Test Plan

- Unit tests for config validation, migration diagnostics, and default
  normalization.
- Snapshot/extraction tests for emitter packet stability, bounds, layer masks,
  and offscreen state retention.
- WebGPU unit tests for particle parameter packing, especially 3D origin.
- Render-plan tests proving particles sort with transparent meshes/sprites.
- E2E smoke tests migrated for current GPU particles and bursts examples.

## Phase 2: Core Shuriken Runtime Subset

### Key Changes

- Replace frame-randomized continuous particles with stateful GPU simulation
  buffers: position, velocity, age, lifetime, size, color seed, rotation, frame,
  alive flag.
- Implement core modules: `main`, `emission`, `shape`, `renderer`,
  `colorOverLifetime`, `sizeOverLifetime`, `rotationOverLifetime`,
  `velocityOverLifetime`, and `forceOverLifetime`.
- Support point, sphere, hemisphere, cone, circle, and box emitters.
- Implement duration, loop, prewarm, start delay, simulation speed, rate over
  time, rate over distance, bursts, burst cycles, intervals, and probability.
- Implement billboard rendering and texture sheet animation.

### Acceptance Criteria

- Continuous particles spawn, age, die, and recycle according to `main` and
  `emission`.
- `startLifetime`, `startSpeed`, `startSize`, `startRotation`, and `startColor`
  support constants, ranges, and curves where applicable.
- Shape emitters produce correct initial positions and velocities.
- `colorOverLifetime`, `sizeOverLifetime`, velocity, force, and rotation modules
  visibly affect particles.
- Texture sheet animation supports grid frame selection and frame-over-life.
- Prewarm produces a visually pre-simulated looping effect on first visible
  frame.

### Test Plan

- Deterministic unit tests for value sampling, seeded randomness, burst
  scheduling, and shape sampling bounds.
- GPU tests for spawn/recycle lifecycle, age/lifetime updates,
  force/velocity integration, and texture frame selection.
- Extraction tests for conservative bounds from shape, velocity, lifetime,
  force, and size.
- E2E examples for smoke, sparks, magic burst, looping fire, and atlas
  animation.
- Browser pixel smoke tests for nonblank output and expected motion over
  multiple frames.

## Phase 3: three.quarks Parity

### Key Changes

- Add render modes: stretched billboard, horizontal billboard, vertical
  billboard, mesh particles, and trails.
- Add emitters: donut, grid, rectangle, and mesh surface.
- Add modules/behaviors matching three.quarks: frame over life, speed over life,
  limit speed, color/size/rotation by speed, orbital motion, noise/turbulence,
  subemitters, and collision hooks.
- Add soft particles and depth fade.
- Add composite VFX assets that spawn multiple coordinated particle emitters.

### Acceptance Criteria

- Every major three.quarks public feature has either runtime support or an
  explicit unsupported diagnostic.
- Quarks-style effects can be represented in Aperture's schema without
  requiring a scene graph.
- Composite effects support multiple emitters with timing offsets, child
  transforms, and shared asset dependencies.
- Trails and stretched billboards render correctly in world and local simulation
  space.
- Soft particles fade against scene depth without breaking non-depth targets.

### Test Plan

- Compatibility fixture tests using representative three.quarks JSON converted
  into Aperture schema.
- Unit tests for each new behavior module and emitter type.
- Render tests for stretched billboards, mesh particles, trails, soft particles,
  and subemitters.
- Snapshot tests for composite VFX assets and child emitter transforms.
- E2E scenes covering quarks-style fire, muzzle flash, projectile trail,
  explosion, and soft smoke.

## Phase 4: Importer Readiness And Diagnostics

### Key Changes

- Add optional asset `source` metadata: `format`, `version`, `sourceName`, and
  `unsupportedFeatures`.
- Add diagnostic categories for Shuriken/three.quarks import mappings,
  approximations, and unsupported modules.
- Document mapping tables from Unity Shuriken and three.quarks concepts into
  Aperture modules.
- Prepare CLI/importer extension points, but do not implement Unity package
  parsing or Unity Editor exporter in this phase.

### Acceptance Criteria

- Imported or converted effects can preserve source metadata and warnings.
- Unsupported source features are reported without failing valid partial
  imports.
- Docs clearly state what maps exactly, what approximates, and what is
  unsupported.
- Future Unity exporter can target the schema without needing schema redesign.

### Test Plan

- Unit tests for source metadata preservation.
- Diagnostic snapshot tests for unsupported and approximated features.
- Documentation validation examples for Shuriken-like and three.quarks-like
  effects.
- Fixture tests proving partial imports can still create valid renderable
  Aperture effects.

## Assumptions

- Canonical API uses Unity Shuriken-style modules, not flat three.quarks fields.
- This is a breaking API change; old flat particle fields are not kept as
  aliases.
- Continuous particle simulation state is GPU-derived.
- Snapshots stay serializable and do not transfer live particle arrays.
- Importers are follow-up work; this plan only makes the schema and diagnostics
  importer-ready.
