# Procedural Sky And Runtime Uniforms Plan

Date: 2026-06-21
Status: implemented

## Implementation Summary

Implemented on 2026-06-21.

- Added ECS-authored `ProceduralSky` extraction and a WebGPU fullscreen
  background pass with a cached sky uniform buffer.
- Migrated the docs-site landing day/night background from authored sky-band
  meshes to `this.spawn.proceduralSky(...)` plus component value updates.
- Added ECS-authored `RuntimeUniform` packets keyed by stable strings.
- Added custom WGSL `runtimeUniformKey` bindings that resolve extracted runtime
  uniform packets into WebGPU-owned uniform buffers.
- Value-only runtime uniform changes update cached buffers with
  `queue.writeBuffer`; shader modules and render pipelines stay keyed by WGSL,
  render state, instance layout, and uniform schema rather than uniform values.
- Tests now cover extraction, change sets, spawn helpers, custom material
  preparation, custom WGSL app-frame resources, shader compilation, docs-site
  typecheck/build, workspace build, and the full unit suite.

## Purpose

Replace the docs-site landing scene's mesh-based sky-gradient workaround with a
first-class renderer sky background, and use that vertical slice to establish a
proper runtime-uniform path for values that change every frame or on user
interaction.

This plan covers two related but separable goals:

- a smooth procedural gradient sky for the landing scene, rendered by the
  renderer rather than by 18 authored box meshes;
- a general route for runtime uniform values that can update without
  re-registering source assets, rebuilding pipelines, or leaking WebGPU objects
  into ECS/app systems.

The procedural sky should land first. General custom WGSL runtime uniforms
should follow after the sky path proves the value-update contract.

## Problem

The current docs-site sky gradient is not a renderer-level sky. It is a stack of
screen-aligned mesh bands:

- `docs-site/src/systems/daynight.system.ts` defines `SKY_BAND_COUNT = 18`.
- `#spawnSkyBands(...)` creates 18 `mesh.box(...)` entities.
- `#setSkyBands(...)` updates each band material through `this.materials.set`.
- `skyBandColor(...)` samples one color per band.

That design has three concrete issues:

1. The visible background can show color bands because each mesh has one flat
   material color.
2. Runtime sky changes mutate many material assets rather than updating one
   renderer-owned uniform buffer.
3. The workaround makes the sky part of scene geometry, when it should be a
   background pass derived from ECS state.

The current custom WGSL material path also does not solve this cleanly:

- Custom WGSL uniform values currently live in source binding declarations.
- WebGPU prepares uniform buffers from those source values.
- `this.materials.set(...)` only supports built-in standard, unlit, and matcap
  material patching.

So Aperture needs both a proper sky path and a later general runtime-uniform
contract.

## Reference Research

This plan was produced from an ultracode reference pass over local checkouts:

- Bevy: `references/bevy`
- PlayCanvas engine: `references/engine`
- Current Aperture packages and docs site

### Bevy

Bevy is the closest architectural reference.

- `Skybox` is ECS-authored camera state with image, brightness, and rotation:
  `references/bevy/crates/bevy_light/src/probe.rs`.
- Skybox extraction copies ECS state into render-world GPU data:
  `references/bevy/crates/bevy_core_pipeline/src/skybox/mod.rs`.
- The skybox shader renders a fullscreen triangle and reconstructs a view ray:
  `references/bevy/crates/bevy_core_pipeline/src/skybox/skybox.wgsl`.
- Dynamic per-entity/per-view uniform data uses `ComponentUniforms`,
  `DynamicUniformBuffer`, and `DynamicUniformIndex`:
  `references/bevy/crates/bevy_render/src/uniform.rs`.
- Atmosphere is separate ECS state plus camera settings, with per-view GPU
  preparation and LUT resources:
  `references/bevy/crates/bevy_pbr/src/atmosphere/mod.rs`.

Useful Aperture lessons:

- Background visuals should be extracted from ECS and rendered as a background
  pass.
- Visual sky and environment lighting should remain separate concepts.
- Runtime values should be packed into GPU uniform resources after extraction.
- Aperture should borrow the pattern, not the exact Rust/plugin shape.

### PlayCanvas

PlayCanvas is less compatible architecturally because sky state is scene-owned,
but its runtime parameter pipeline is useful.

- The scene owns skybox/env-atlas state, sky type, mip, intensity, rotation, and
  related parameters: `references/engine/src/scene/scene.js`.
- Sky visuals use a `SkyMesh`, `ShaderMaterial`, and cube/dome geometry:
  `references/engine/src/scene/skybox/sky-mesh.js`.
- Material parameters are set by name and applied before rendering:
  `references/engine/src/scene/materials/material.js`.
- Uniform buffers pack current scoped uniform values at update time:
  `references/engine/src/platform/graphics/uniform-buffer.js`.

Useful Aperture lessons:

- Keep shader/layout changes separate from value-only updates.
- Keep visible sky and environment lighting resources separate but coordinated.
- Do not copy stringly global mutable scene state; Aperture should use typed
  ECS/snapshot data instead.

### Aperture Current State

Relevant current implementation points:

- `packages/render/src/rendering/authoring-components-core.ts` has a `Skybox`
  component with only `textureId`, `samplerId`, and `intensity`.
- Skybox extraction validates cube texture assets and emits skybox packets.
- `packages/webgpu/src/render/skybox/skybox-pipeline.ts` already renders the
  cube skybox with a fullscreen triangle.
- `packages/webgpu/src/app/frame-boundaries.ts` inserts skybox commands before
  per-view scene commands.
- `packages/app/src/systems/materials.ts` patches built-in material asset
  values by re-registering the asset; unsupported material kinds, including
  custom WGSL, are rejected.
- `packages/render/src/materials/types.ts` defines custom WGSL uniform binding
  schemas, but values are source data.
- `packages/webgpu/src/materials/custom-wgsl/custom-wgsl-app-frame-resources.ts`
  encodes those source values into renderer-owned uniform buffers.

## Design Direction

### Use A Background Pass, Not Scene Geometry

The first procedural sky should be a WebGPU fullscreen background pass beside
the existing skybox pass.

Do not implement the landing gradient as:

- a stack of planes or boxes;
- a scene sphere that behaves like regular geometry;
- a custom WGSL material attached to a large mesh;
- a renderer-owned mutable scene node.

A sphere or dome can be a useful authoring metaphor in some engines, but the
clean Aperture path is a renderer background pass derived from ECS state. That
keeps the sky out of the scene graph, avoids depth/mesh interactions, and fits
the current skybox command insertion point.

### Keep Cube Skybox And Procedural Sky Separate

Do not silently overload cube `Skybox` with unrelated fields.

Add a separate visual-background component or a discriminated background packet.
Recommended public name:

- `ProceduralSky` with `model: "gradient"`; or
- `GradientSky` if the first version is intentionally narrow.

`ProceduralSky` is the better long-term name if the initial version includes
sun glow, horizon shaping, noise/dither, or later atmosphere models.

### Use Sky-Specific Runtime Uniforms First

Do not make the entire custom WGSL runtime-uniform system a prerequisite for the
sky fix.

The first slice should create a sky-specific cached uniform buffer and bind
group in `@aperture-engine/webgpu`. Value-only changes should update that
buffer with `queue.writeBuffer` and should not recreate the pipeline.

Once that contract is proven, generalize it into a reusable typed
`RuntimeUniform` or `UniformResource` path.

### Avoid Dynamic Offset Requirements In The First Slice

Bevy uses dynamic uniform offsets, but Aperture's current render command model
does not expose dynamic bind group offsets. The first implementation should use
stable bind groups and direct uniform-buffer uploads.

Dynamic-offset style batching can be a later optimization if the render command
model grows support for it.

### Preserve Package Boundaries

Follow the existing package ownership:

- `@aperture-engine/render`: authoring component, validation, extraction,
  snapshot packet shape, diagnostics.
- `@aperture-engine/webgpu`: GPU buffers, bind groups, pipelines, shader code,
  command planning, and submission.
- `@aperture-engine/app`: ergonomic spawn/system APIs.
- `@aperture-engine/runtime`: low-level helper exports if needed.
- `docs-site`: consumer of the public API, not a renderer workaround layer.

No ECS/app component should store a `GPUBuffer`, `GPUTexture`, `GPUTextureView`,
`GPUSampler`, `GPUBindGroup`, `GPUShaderModule`, `GPURenderPipeline`, callback,
or backend object.

## Proposed Authoring Shape

Exact names can change during implementation, but the public API should be
typed and data-only.

```ts
this.spawn.proceduralSky({
  key: "landing.sky",
  model: "gradient",
  priority: 0,
  topColor: [0.015, 0.02, 0.08],
  horizonColor: [0.04, 0.055, 0.13],
  bottomColor: [0.006, 0.008, 0.025],
  horizonPosition: 0.38,
  horizonSoftness: 0.24,
  intensity: 1,
  sunDirection: [-0.6, 0.4, -0.7],
  sunColor: [1.0, 0.72, 0.38],
  sunRadius: 0.02,
  sunGlow: 0.35,
  ditherStrength: 0.003,
});
```

Runtime updates should mutate component/system data, not source material assets:

```ts
this.sky.set("landing.sky", {
  topColor: sample.skyTop,
  horizonColor: sample.skyHorizon,
  bottomColor: sample.skyBottom,
  sunDirection: sample.sunDirection,
  intensity: sample.skyIntensity,
});
```

If there is no dedicated `this.sky` facade yet, the first slice can use normal
component field mutation behind the app system API. The durable requirement is
that the extracted snapshot changes value data only.

## Procedural Sky Packet

Add a renderer-independent packet along these lines:

```ts
export interface ProceduralSkyPacket {
  readonly entityId: number;
  readonly layerMask: number;
  readonly priority: number;
  readonly model: "gradient";
  readonly topColor: readonly [number, number, number];
  readonly horizonColor: readonly [number, number, number];
  readonly bottomColor: readonly [number, number, number];
  readonly horizonPosition: number;
  readonly horizonSoftness: number;
  readonly intensity: number;
  readonly sunDirection: readonly [number, number, number];
  readonly sunColor: readonly [number, number, number];
  readonly sunRadius: number;
  readonly sunGlow: number;
  readonly ditherStrength: number;
}
```

Extraction should:

- apply visibility and layer filtering;
- clamp or diagnose invalid colors and finite numeric fields;
- normalize or diagnose invalid sun direction;
- select at most one visual background per view;
- diagnose same-priority ambiguity when multiple backgrounds match.

## WebGPU Sky Pass

Add a pipeline beside `packages/webgpu/src/render/skybox/skybox-pipeline.ts`.

Shader shape:

- fullscreen triangle;
- reconstruct view direction from the view uniform, matching the existing
  skybox approach;
- evaluate a smooth bottom -> horizon -> top gradient using `smoothstep`;
- add optional sun disk/glow from ray/sun angular distance;
- apply intensity;
- add tiny screen-space or blue-noise-style dither to mask 8-bit display bands;
- write opaque color as the background.

The shader should not sample 18 CPU-chosen colors. The GPU should interpolate
continuously from a small uniform set.

Resource behavior:

- cache the render pipeline by color/depth format and sample count;
- cache a small uniform buffer and bind group by view/background identity;
- update value changes with `queue.writeBuffer`;
- keep value-only updates out of pipeline keys;
- do not recreate bind groups unless layout/resource identity changes.

Ordering:

- integrate at the same frame-boundary point as skybox commands;
- preserve clear/depth behavior;
- define precedence between cube `Skybox` and `ProceduralSky`.

## Runtime Uniforms Follow-Up

After procedural sky lands, generalize the update path into a typed
runtime-uniform facility.

Recommended public concept:

- `RuntimeUniform`
- `UniformResource`
- `runtimeUniformKey`

The system should distinguish:

- structural schema/layout data: affects bind group layout, pipeline cache,
  validation, and material preparation;
- runtime values: update buffer contents only.

For custom WGSL, evolve uniform declarations from:

```ts
material.uniform("water", {
  binding: 0,
  fields: {
    time: { type: "float32", default: 0 },
  },
  values: { time: 0 },
});
```

to a schema-plus-runtime reference:

```ts
material.uniform("water", {
  binding: 0,
  fields: {
    time: { type: "float32", default: 0 },
  },
  runtimeUniformKey: "water.params",
});
```

Then app systems can update the runtime values:

```ts
this.uniforms.set("water.params", {
  time: elapsedSeconds,
});
```

The `@aperture-engine/render` layer should carry only JSON-safe uniform schemas,
keys, values, versions, and diagnostics. The WebGPU backend should own buffer
allocation, uploads, bind groups, and cache behavior.

## Implementation Sequence

### Phase 1 - Render Authoring And Extraction

Add `ProceduralSky` or `GradientSky` to render authoring.

Work items:

- component definition in `packages/render`;
- input types and validation helpers;
- extraction into a snapshot packet;
- layer/visibility/priority selection;
- JSON-safe diagnostics;
- app/runtime spawn helpers.

Acceptance criteria:

- a headless extraction test emits one procedural sky packet;
- invalid numeric/color/sun data emits diagnostics;
- cube skybox/procedural sky conflicts have deterministic behavior and
  diagnostics.

### Phase 2 - WebGPU Fullscreen Procedural Sky

Add the renderer-owned sky-gradient pass.

Work items:

- WGSL pipeline;
- uniform packing;
- cached uniform buffer/bind group;
- command assembly beside skybox;
- report/motion-vector/status path updates where skyboxes are counted or
  special-cased.

Acceptance criteria:

- value-only sky changes do not recreate the pipeline;
- value-only sky changes ideally do not recreate the bind group;
- browser proof shows a smooth background with no mesh bands;
- existing cube skybox behavior does not regress.

### Phase 3 - Docs-Site Migration

Replace the landing scene sky-band workaround.

Work items:

- remove or bypass sky band spawning;
- update day-night sampling to produce procedural sky values;
- update demand-render timing so sky changes still trigger renders only when
  the story changes;
- remove per-band material mutation.

Acceptance criteria:

- night checkpoint screenshot no longer shows horizontal color bands from mesh
  bands;
- dawn/dusk transitions remain smooth;
- WebGPU status remains clean;
- page performance does not regress.

### Phase 4 - Runtime Uniform Core

Extract the sky-specific uniform upload pattern into a reusable facility.

Work items:

- renderer-independent uniform schema/value types;
- stable runtime uniform keys;
- dirty/version tracking;
- WebGPU uniform resource cache;
- JSON-safe reports for buffer upload and readiness state.

Acceptance criteria:

- updating a runtime uniform value changes GPU-visible data without material
  source asset re-registration;
- layout/schema changes remain structural and correctly invalidate prepared
  resources;
- diagnostics explain missing, invalid, or stale uniform values.

### Phase 5 - Custom WGSL Runtime Uniforms

Wire runtime uniforms into custom WGSL bindings.

Work items:

- add `runtimeUniformKey` or equivalent to custom WGSL uniform declarations;
- keep source declarations as schema/layout data;
- resolve runtime values through extracted uniform packets;
- preserve texture/sampler behavior;
- report missing runtime uniform values clearly.

Acceptance criteria:

- a custom WGSL example animates a uniform value at runtime;
- the material source asset version does not change for value-only updates;
- shader modules and pipelines are not recreated for value-only updates;
- built-in material paths remain unaffected.

## Validation Plan

Run targeted validation as each phase lands:

- extraction/unit tests for procedural sky packets and diagnostics;
- WebGPU resource tests for pipeline/bind-group reuse;
- browser screenshot/readback proof for smooth sky gradients;
- docs-site typecheck/build;
- focused custom WGSL runtime uniform tests after Phase 5;
- broader package typecheck once API surfaces are exported.

Suggested browser visual test:

- sample multiple adjacent rows in the sky background;
- assert there are no large constant-color plateaus matching the old 18-band
  layout;
- assert dawn, noon, dusk, and night checkpoints all produce distinct gradient
  signatures.

## Open Questions

1. Public name: `ProceduralSky` vs `GradientSky`.
2. Should the first sky pass include sun disk/glow, or only gradient/dither?
3. Should visual sky and future environment lighting share authoring data, or
   should environment lighting remain a separate explicit component from day
   one?
4. Should runtime uniform values be global resources, entity components, or both
   in the first general implementation?
5. What reporting surface should expose uniform upload churn and value-only
   cache behavior?

## Non-Goals

- Do not implement a full physical atmosphere in the first slice.
- Do not generate IBL/environment maps from procedural sky in the first slice.
- Do not add a scene graph or renderer-owned sky object.
- Do not expose raw WebGPU resources to app systems.
- Do not require a custom WGSL material just to draw the sky.
- Do not make dynamic bind group offsets a prerequisite.

## Recommended Next Step

Start with Phase 1 and Phase 2 as one vertical feature slice:

1. add `ProceduralSky`/`GradientSky` extraction;
2. render it as a WebGPU fullscreen background with a cached uniform buffer;
3. prove it in a minimal test/example route;
4. then migrate the docs-site landing scene.

This solves the visible banding while establishing the runtime-value update
pattern that the broader custom WGSL uniform system can later reuse.
