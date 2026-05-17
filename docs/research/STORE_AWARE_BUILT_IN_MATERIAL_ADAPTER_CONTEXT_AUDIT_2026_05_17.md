# Store-Aware Built-In Material Adapter Context Audit - 2026-05-17

## Scope

Audit the store-aware built-in material adapter context added after the
WebGPU-private prepared built-in material store. The goal is to verify adapter
callbacks now receive prepared material store access explicitly without changing
source asset authority, `RenderSnapshot` semantics, adjacent resource
ownership, or public report shape.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/RENDER_ASSET_PREPARATION.md`
- `docs/research/PREPARED_BUILT_IN_MATERIAL_STORE_BOUNDARY_AUDIT_2026_05_17.md`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts`
- `test/webgpu/built-in-material-app-resource-adapter.test.ts`
- `test/webgpu/webgpu-app.test.ts`
- `references/bevy/crates/bevy_render/src/render_asset.rs`
- `references/bevy/crates/bevy_pbr/src/material.rs`

## Findings

### Adapter Preparation Context

No drift found.

- `QueuedBuiltInFrameResourcePreparationOptions` now exposes
  `preparedMaterials: PreparedBuiltInMaterialStore` as an explicit context.
- The adapter callback cache view uses `Omit<WebGpuAppResourceCache,
"preparedMaterials">`, so family callbacks no longer reach through the app
  cache for prepared material buckets.
- Single-material and queued-material paths both pass the same store context
  from `resourceCache.preparedMaterials`.
- Family callbacks still select only their typed bucket:
  `preparedMaterials.unlit`, `preparedMaterials.matcap`, or
  `preparedMaterials.standard`.

### Ownership Boundaries

No drift found.

- Source material assets still come from the app asset registry and are used to
  build queue items before adapter frame preparation.
- `RenderSnapshot` remains unchanged and carries handles/packets, not prepared
  cache entries or GPU resources.
- Texture and sampler GPU resources remain separate app resource caches and are
  passed to material preparation as explicit dependencies.
- Standard light resources remain frame-derived group-3 resources and are not
  included in prepared material store ownership or keys.

### Public API And Reports

No drift found.

- Public app reports still expose JSON-safe reuse counters and prepared material
  cache summaries only.
- Store internals and raw WebGPU handles are not included in reports.
- The prepared built-in material store remains private to WebGPU internals and
  is not exported through the public package surface.
- Focused app tests now assert prepared material cache summary counts during
  source material, texture, and sampler invalidation.

### Remaining Coupling

Acceptable short-term coupling remains.

- The app still owns route orchestration, pipeline lookup, and family bucket
  selection.
- The multi-unlit route remains a narrow special path outside the generic
  adapter flow.
- This is consistent with the current migration stage. The next broadening step
  should be renderer-independent material metadata in the render world, not
  making WebGPU store internals public.

## Decision

The store-aware adapter context is a valid incremental boundary improvement. It
reduces direct app-cache reach-through in adapter callbacks while preserving the
WebGPU-only ownership of material buffers and bind groups.

Proceed with targeted store lifecycle and render-world metadata slices:

1. Add unload/clear summary coverage for the WebGPU-private prepared built-in
   material store.
2. Plan texture/sampler dependency-store boundaries so prepared material stores
   depend on those resources without owning them.
3. Implement the renderer-independent prepared material store facade in
   `@aperture-engine/render`.

## Follow-Ups

- Keep `task-0858` for prepared built-in material store unload summary coverage.
- Keep `task-0859` for prepared texture/sampler dependency boundary planning.
- Keep `task-0860` for the render prepared material store facade implementation.
