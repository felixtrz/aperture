# Scalar Standard Prepared App Route Boundary Audit - 2026-05-17

## Scope

Audit the scalar `StandardMaterial` prepared material cache after app-route
integration and before adding more invalidation coverage or textured Standard
dependency keys.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/RENDER_ASSET_PREPARATION.md`
- `docs/DECISIONS.md`
- `docs/research/STANDARD_SCALAR_PREPARED_MATERIAL_CACHE_PLAN_2026_05_17.md`
- `docs/research/PREPARED_ROUTE_COUNTER_BOUNDARY_AUDIT_2026_05_17.md`
- `packages/webgpu/src/webgpu/prepared-standard-material-cache.ts`
- `packages/webgpu/src/webgpu/prepared-unlit-material-cache.ts`
- `packages/webgpu/src/webgpu/standard-app-frame-resources.ts`
- `packages/webgpu/src/webgpu/standard-frame-resources.ts`
- `packages/webgpu/src/webgpu/app.ts`
- `test/webgpu/prepared-standard-material-cache.test.ts`
- `test/webgpu/webgpu-app.test.ts`

## Findings

- The scalar Standard prepared cache is WebGPU-owned and renderer-derived. It
  consumes a ready `StandardMaterialAsset`, source material handle/version,
  pipeline key, group-2 layout key, and injected WebGPU-like device, then owns
  only the derived material uniform buffer, group-2 material bind group, logical
  resource keys, and source metadata.
- The cache does not store ECS entities, components, transforms, cameras, draw
  queues, render snapshots, frame lifecycle state, command encoders, or app
  ownership. `createWebGpuApp` keeps the cache in the WebGPU resource cache
  alongside other backend-owned resource stores.
- Textured Standard variants remain outside the scalar cache. The helper skips
  any material with base-color, metallic-roughness, normal, occlusion, or
  emissive texture bindings and returns JSON-safe diagnostics instead of
  creating incomplete prepared resources.
- Texture and sampler GPU resources remain in the existing
  `app-texture-sampler-resources` path. The scalar prepared resource cache does
  not attempt to own texture views, sampler objects, UV dependency state, or
  texture dependency source versions.
- Light resources remain frame-derived. Standard group-3 light buffers and light
  bind groups are still created by `standard-frame-resources.ts` from the
  extracted `RenderSnapshot`, not cached as material state.
- App reports expose JSON-safe prepared material buffer and bind-group
  creation/reuse counts. They do not expose cache maps, raw GPU buffers, raw
  bind groups, descriptors, or mutable backend objects.
- Public WebGPU exports include the prepared helper for direct focused testing,
  but the retired umbrella package, `@aperture-engine/render`, and
  `@aperture-engine/simulation` remain free of WebGPU imports.

## Follow-Up Guardrails

- `task-0822` should add app-route invalidation coverage only for scalar
  Standard source material version changes and frame-resource cache-hit behavior.
  It should not start textured Standard dependency caching.
- `task-0823` should keep textured Standard dependency planning explicit for all
  five texture families and should continue to exclude group-3 light resources
  from material dependency cache keys.
- The prepared Standard app route should continue counting full frame-resource
  cache hits separately from prepared material cache reuse, so reports stay
  useful for distinguishing dynamic buffer writes from prepared-resource reuse.

## Outcome

No boundary drift was found. The scalar Standard prepared material route matches
the planned staged handoff: source assets stay authoritative, render snapshots
remain the frame boundary, and WebGPU-owned prepared resources stay derived from
ready source material state.
