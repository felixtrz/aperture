# Custom Material Source API Design Brief

Date: 2026-05-18

Task: `task-1698`

## Purpose

This is a non-binding design brief for future public custom material support.
It does not accept a public API, add runtime behavior, or enable app-owned
material adapters. Decision 0011 still requires a later accepted decision before
public app-owned material adapter facades or public custom material source
assets are implemented.

## Minimum Contract Questions

### Source Asset Shape

- What stable `kind` or family identifier format is valid for public custom
  material assets?
- Which fields are required for a minimum source material: label, render phase,
  shader references, bind group schema, render-state policy, and pipeline key
  inputs?
- Are custom materials stored in a generic typed collection, a specialized
  `Assets<CustomMaterialAsset>`, or separate family-specific typed
  collections?

Decision needed before implementation: public source asset shape and family-key
validation rules.

### Validation

- Which diagnostics are source validation errors versus render-route errors?
- How are duplicate family keys, collisions with built-ins, unsupported shader
  capabilities, invalid binding schemas, and invalid render-state combinations
  reported?
- Which validation runs at asset registration time, extraction time, preparation
  time, and app facade setup time?

Decision needed before implementation: validation phases and diagnostic code
families.

### Dependency Declaration

- How does a custom material declare texture, sampler, buffer, shader, mesh
  layout, light, environment, or user-provided uniform dependencies?
- Are dependencies declared as data-only schemas suitable for snapshots and
  worker transport?
- How are optional dependencies represented without hiding unsupported features
  behind fallback behavior?

Implementation tasks later: dependency readiness reports, JSON summaries, and
tests for missing/loading/failed dependencies.

### Preparation And Lifetime

- What adapter interface maps source assets to renderer-owned prepared
  resources?
- How are source versions, dependency versions, unload, cache invalidation, and
  stale prepared resources represented?
- Which parts are setup-only and which parts run on the frame hot path with
  caller-owned scratch?

Decision needed before implementation: prepared-resource lifecycle and cache
ownership boundary.

### Shader, Bind Group, And Pipeline Contracts

- Does the public API accept shader module references, WGSL strings, or only
  registered shader assets?
- How is bind group layout metadata declared without exposing raw WebGPU objects
  in source assets?
- How are pipeline keys specialized by render phase, mesh layout, material
  state, alpha mode, cull mode, depth state, and optional features?

Decision needed before implementation: shader/resource declaration model.

### Diagnostics And JSON Surfaces

- Which public report fields expose custom material readiness and route health?
- How do reports distinguish source validation, route preparation, dependency
  readiness, frame-resource creation, and pipeline specialization failures?
- Which values are safe to serialize: family names, stable resource keys,
  versions, counts, statuses, phases, and diagnostic codes.

Never expose raw `GPUBuffer`, `GPUBindGroup`, `GPUTexture`, texture views,
samplers, pipelines, shader modules, adapter callbacks, app objects, cache maps,
or source payload bytes in JSON surfaces.

### Worker Boundary Compatibility

- Can the source material schema be cloned or serialized across future worker
  boundaries?
- Can extracted route data carry only stable keys and scalar state?
- Can the renderer prepare resources without reading authoritative ECS/game
  state?

Implementation tasks later: snapshot serialization tests and route data JSON
tests.

## Non-Goals For The First Public Design

- No shader graph.
- No arbitrary live WebGPU objects in source assets.
- No app-level non-built-in rendering until source validation and preparation
  are designed.
- No IBL, shadows, binary GLB loading, or custom PBR family in the same slice.
- No hidden fallback to built-in material families.

## Likely Follow-Up Work

1. Add a decision record for the public custom material source asset shape.
2. Add source validation diagnostics and JSON-safe tests.
3. Add a test-only public-shape source fixture that still does not render.
4. Add prepared-resource adapter contracts for the public source shape.
5. Add a minimal rendered custom family proof only after source, dependencies,
   preparation, shader/resource, and diagnostics contracts are in place.
