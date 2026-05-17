# Standard Textured-Family Prepared Route Audit - 2026-05-17

## Scope

Audit the expanded textured `StandardMaterial` prepared material route after
base-color and metallic-roughness helpers, app-route integration, and
invalidation coverage.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/RENDER_ASSET_PREPARATION.md`
- `docs/DECISIONS.md`
- `docs/research/STANDARD_TEXTURED_PREPARED_DEPENDENCY_HANDOFF_PLAN_2026_05_17.md`
- `docs/research/TEXTURED_STANDARD_BASE_COLOR_PREPARED_BOUNDARY_AUDIT_2026_05_17.md`
- `packages/webgpu/src/webgpu/prepared-standard-material-cache.ts`
- `packages/webgpu/src/webgpu/standard-app-frame-resources.ts`
- `packages/webgpu/src/webgpu/app-texture-sampler-resources.ts`
- `packages/webgpu/src/webgpu/standard-frame-resources.ts`
- `test/webgpu/prepared-standard-material-cache.test.ts`
- `test/webgpu/webgpu-app.test.ts`
- Reference engine patterns: `references/engine/src/platform/graphics/webgpu/webgpu-bind-group.js`,
  `references/engine/src/platform/graphics/webgpu/webgpu-texture.js`
- Reference three.js patterns:
  `references/three.js/src/renderers/common/Bindings.js`

## Findings

- The base-color and metallic-roughness Standard prepared helpers remain
  WebGPU-owned and renderer-derived. They consume ready source material data,
  source material versions, pipeline keys, group-2 layout keys, texture/sampler
  source-version dependency keys, prepared texture resources, prepared sampler
  resources, and an injected WebGPU-like device.
- The prepared Standard material cache owns only group-2 material resources:
  Standard material uniform buffers, Standard material bind groups, logical
  resource keys, source material metadata, and texture/sampler dependency cache
  segments. It does not own ECS entities, components, render snapshots, draw
  queues, render passes, command encoders, texture upload policy, sampler
  creation policy, or app lifecycle state.
- Texture and sampler GPU resources remain separate dependencies prepared by
  `app-texture-sampler-resources.ts`. The prepared material helpers receive
  those resources as inputs and do not store app texture/sampler cache maps or
  source texture/sampler assets.
- Group-3 light resources remain frame-derived. `standard-frame-resources.ts`
  still derives light buffers and bind groups from `RenderSnapshot` light data,
  and no light resource, light version, or light layout segment is included in a
  prepared material cache key.
- App-route counters continue to distinguish full frame-resource cache hits
  from prepared material cache reuse. A full frame hit updates dynamic buffers
  and reports reused frame resources; a frame-resource miss can still reuse
  prepared mesh resources, prepared material buffers, prepared material bind
  groups, textures, and samplers independently.
- Public reports remain JSON-safe scalar counters. Tests assert reuse behavior
  without exposing raw GPU buffers, bind groups, texture views, sampler objects,
  descriptors, cache maps, or device handles.
- The current implementation now has two single-texture-family Standard
  prepared helpers with similar structure. Normal, occlusion, and emissive work
  should first decide whether to extract a private generic single-family helper
  or land as one carefully bounded multi-family helper; otherwise the route will
  accumulate repeated family-specific branches.

## Follow-Up Guardrails

- `task-0834` should explicitly decide the helper shape for normal, occlusion,
  and emissive prepared resources before runtime code changes continue.
- Remaining texture-family work should keep tangent/normal-map vertex
  requirements in readiness diagnostics, not in material cache ownership.
- Group-3 light buffers and light bind groups must stay outside material cache
  keys for all Standard texture families.
- Texture/sampler source-version invalidation should continue to be tested
  through JSON-safe app reports, not by inspecting private cache maps.

## Outcome

No ownership drift was found. The expanded textured Standard route follows the
North Star boundary: source assets remain authoritative, texture/sampler GPU
resources are backend dependencies, group-2 prepared material resources are
WebGPU-owned, and lighting resources remain frame-derived from extracted
snapshots.
