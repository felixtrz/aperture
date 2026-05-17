# Prepared Built-In Material Store Boundary Audit - 2026-05-17

## Scope

Audit the WebGPU-private prepared built-in material store added after the
adapter-driven preparation route. The goal is to verify the store is only a
backend cache container and does not change ECS authority, `RenderSnapshot`
semantics, public API shape, or ownership of adjacent texture/sampler and light
resources.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/RENDER_ASSET_PREPARATION.md`
- `docs/research/RENDER_WORLD_PREPARED_MATERIAL_STORE_HANDOFF_PLAN_2026_05_17.md`
- `packages/webgpu/src/webgpu/prepared-built-in-material-store.ts`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/index.ts`
- `references/bevy/crates/bevy_render/src/render_asset.rs`
- `references/bevy/crates/bevy_pbr/src/material.rs`

## Reference Pattern

Bevy keeps source assets separate from prepared render assets. Its
`RenderAssets` resources store GPU-facing prepared representations keyed by
source asset IDs, and material preparation can retry when dependencies such as
prepared images are not ready.

Aperture should continue borrowing that separation without adopting Bevy's
render sub-app shape directly:

```text
ECS/source asset
  -> extracted snapshot/handle/version data
  -> renderer-independent prepared metadata
  -> WebGPU-owned prepared resource cache
  -> frame-local bind group and draw submission
```

The new store is only the WebGPU-owned prepared resource cache container for
current built-in material families.

## Findings

### Source Asset And Snapshot Authority

No drift found.

- `PreparedBuiltInMaterialStore` stores only unlit, Matcap, and Standard
  prepared material cache buckets.
- The store does not import simulation, render snapshots, ECS worlds, source
  asset collections, or app-level frame state.
- App routing still derives material work from `RenderSnapshot` draw packets and
  source asset lookups before handing a typed family cache to each helper.
- `RenderSnapshot` remains unchanged and still carries handles/packets rather
  than GPU resources or cache entries.

### WebGPU Resource Ownership

No drift found.

- The store lives under `@aperture-engine/webgpu` and owns WebGPU-prepared
  material cache buckets only.
- The public WebGPU `index.ts` does not export
  `prepared-built-in-material-store.ts` or its types.
- Summary reporting goes through `writePreparedBuiltInMaterialStoreSummary()`,
  which writes JSON-safe counts using the existing prepared app material summary
  helper.
- Tests assert the store helper remains absent from the public WebGPU package
  surface.

### Adjacent Resource Boundaries

No drift found.

- Texture and sampler GPU resources remain separate app resource caches and are
  passed into material preparation as dependencies.
- Standard group-3 light resources remain frame-derived and are not included in
  material cache keys or store ownership.
- Prepared mesh caches, frame-resource cache slots, pipelines, layouts, and
  command submission remain outside the prepared material store.

### Route Coupling

Acceptable short-term coupling remains.

- App routing still selects the unlit, Matcap, or Standard bucket before calling
  frame-resource helpers.
- This is consistent with the handoff plan's smallest vertical slice, but the
  next implementation step should move adapter callbacks toward receiving the
  store or a typed family bucket through a store-aware preparation context.
- The pre-existing multi-unlit route remains a special path and should stay
  narrow until the generic queue/adapter path can cover it honestly.

## Decision

The prepared built-in material store is a valid intermediate WebGPU-private
container. It reduces scattered app cache fields without changing ownership
boundaries or public API shape.

Proceed with the next store-aware adapter slice before attempting a broader
render-world prepared material store API. That keeps the migration incremental:

1. WebGPU-private store container.
2. Store-aware adapter preparation context.
3. Invalidation and summary regressions around the store.
4. Renderer-independent render-world prepared material store API plan.

## Follow-Ups

- Keep `task-0853` as the next task: move built-in material adapter callbacks to
  receive the prepared built-in material store or typed family bucket through a
  store-aware preparation context.
- Keep `task-0854` for app-level invalidation summary coverage across material,
  texture, and sampler source-version changes.
- Keep `task-0855` as a plan-only task for the renderer-independent
  render-world prepared material store API after the WebGPU-local store context
  is better shaped.
