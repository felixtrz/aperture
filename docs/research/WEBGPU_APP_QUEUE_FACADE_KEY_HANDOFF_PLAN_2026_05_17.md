# WebGPU App Queue Facade Key Handoff Plan - 2026-05-17

## Scope

Plan the smallest route from WebGPU app-local material resource key resolution
toward renderer-independent prepared material facade keys.

This is a planning slice only. It does not change queue behavior or move backend
resource ownership.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/research/WEBGPU_PREPARED_MATERIAL_FACADE_SUMMARY_HANDOFF_PLAN_2026_05_17.md`
- `packages/render/src/assets/preparation.ts`
- `packages/render/src/materials/prepared-resource.ts`
- `packages/render/src/rendering/prepared-material-queue-resolver.ts`
- `packages/render/src/rendering/render-world-prepared-materials.ts`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/prepared-app-material-resource.ts`
- `packages/webgpu/src/webgpu/prepared-built-in-material-store.ts`
- `references/bevy/crates/bevy_render/src/render_asset.rs`
- `references/bevy/crates/bevy_pbr/src/material.rs`

## Current State

The WebGPU app now owns two material preparation surfaces:

- `resourceCache.preparedMaterialFacade`: renderer-independent prepared material
  descriptors keyed by source material handle.
- `resourceCache.preparedMaterials`: WebGPU-private prepared built-in material
  cache entries keyed by family-specific backend cache inputs.

The app currently prepares the facade after `renderWebGpuAppFrame()` so reports
can expose `resourceReuse.preparedMaterialFacade`. Queue construction still uses
app-local source asset resource keys:

```text
RenderSnapshot
  -> index source mesh/material assets
  -> writeMaterialQueueFromSnapshot(source asset resource keys)
  -> create WebGPU buffers/bind groups/textures/samplers
  -> writeMaterialQueueFromSnapshot(WebGPU resource keys)
  -> encode draws
```

This keeps the existing frame path working, but it means the first material
queue pass does not yet use the prepared material facade as the renderer-side
contract.

## Reference Pattern

Bevy separates the stages:

- Source assets are extracted into render-side asset state.
- Render assets are prepared into `RenderAssets<T>`.
- Material queueing looks up prepared mesh/material resources and leaves missing
  assets pending instead of treating source assets as the render resource.

Aperture should keep the same separation while adapting it to the current
snapshot and WebGPU-only model:

```text
RenderSnapshot material handles
  -> PreparedMaterialStore descriptors
  -> material queue resource key resolver
  -> WebGPU backend resource cache lookup/creation
  -> draw encoding
```

## Smallest Handoff

1. Prepare `resourceCache.preparedMaterialFacade` before the first queued
   built-in app resource-set collection, not only after `renderWebGpuAppFrame()`.
2. Use `createPreparedMaterialQueueResourceKeyResolver()` as the
   `materialResourceKey` resolver for the first `writeMaterialQueueFromSnapshot`
   pass.
3. Keep the mesh resolver unchanged until a matching prepared mesh facade exists.
4. Treat missing facade entries as queue diagnostics, matching the existing
   unsupported or not-ready queue path.
5. Continue creating WebGPU material buffers and bind groups through the
   built-in family adapters.
6. Keep the second queue pass over concrete WebGPU resources in place until draw
   encoding can consume facade keys plus backend resource lookups directly.

The first implementation can be a narrow behavior-preserving handoff if the
prepared descriptor key and backend material buffer key are bridged explicitly:

```text
prepared-material:material:foo
  -> WebGPU prepared resource cache entry
  -> material-buffer:prepared-material:material:foo
```

That bridge should live in the WebGPU package because the buffer key is a backend
resource identity. The render package should only produce
`prepared-material:*` and `prepared-material-bind-group:*` logical keys.

## Backend-Owned State

These remain WebGPU-owned after the handoff:

- Prepared material uniform buffers.
- Material bind groups.
- Texture and sampler GPU resources.
- Pipeline resources and layout lookup.
- Light buffers and group-3 bind groups for StandardMaterial.
- Family-specific prepared material cache keys and invalidation policy.
- Command encoding and submission.

The renderer-independent facade owns only prepared metadata: logical material
resource keys, logical bind-group keys, pipeline keys, dependency keys, texture
binding metadata, dependency readiness, and JSON-safe diagnostics.

## Expected Tests

The first implementation slice should prove:

- The first material queue pass uses prepared material facade keys.
- Source material asset resource keys are no longer required as material queue
  resource keys for built-in material families.
- Existing backend cache counters and texture/sampler counters remain unchanged.
- Missing facade preparation emits JSON-safe diagnostics and does not submit a
  partially invalid frame.

## Follow-Up Task Shape

```md
### task-next - Route app material queue through prepared facade keys

Category: `webgpu-render`
Package/write-scope: WebGPU app queue collection and focused app/material queue
tests.
Reference anchor:
`WEBGPU_APP_QUEUE_FACADE_KEY_HANDOFF_PLAN_2026_05_17.md`,
`createPreparedMaterialQueueResourceKeyResolver`,
`prepareAndBindSnapshotMaterialsToRenderWorld`, and Bevy prepared render asset
queue lookup patterns.

Acceptance criteria:

- The first WebGPU app material queue pass resolves material resource keys from
  `PreparedMaterialStore` descriptors.
- Backend WebGPU resource creation remains family-adapter owned.
- Tests prove report counters and texture/sampler resource ownership stay
  separate from renderer-independent prepared material keys.
```
