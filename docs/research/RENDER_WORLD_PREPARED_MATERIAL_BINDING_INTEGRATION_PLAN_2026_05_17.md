# Render-World Prepared Material Binding Integration Plan - 2026-05-17

## Scope

Plan the smallest runtime slice that uses renderer-independent prepared material
facade entries to update `RenderWorld` material resource bindings. This is a
planning task only.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/RENDER_ASSET_PREPARATION.md`
- `docs/research/GENERIC_RENDER_WORLD_PREPARED_MATERIAL_STORE_API_PLAN_2026_05_17.md`
- `docs/research/RENDER_PREPARED_MATERIAL_STORE_FACADE_BOUNDARY_AUDIT_2026_05_17.md`
- `packages/render/src/assets/preparation.ts`
- `packages/render/src/rendering/render-world.ts`
- `test/assets/render-asset-preparation.test.ts`
- `references/bevy/crates/bevy_render/src/render_asset.rs`

## Current State

- `PreparedMaterialStore` prepares renderer-independent
  `PreparedMaterialAssetMetadata` entries keyed by source material handle.
- Each prepared entry exposes logical `materialResourceKey` and
  `bindGroupResourceKey` strings.
- `RenderWorldObject.gpu.materialResourceKey` is already a nullable string
  placeholder.
- `RenderWorld.createDrawReadinessReport()` marks a draw blocked until both mesh
  and material resource keys are present.
- WebGPU prepared material caches remain backend-owned and consume the logical
  material key later during app frame-resource preparation.

## Smallest Integration Slice

Add a render package helper that binds prepared material metadata into a render
world without changing `RenderSnapshot`:

```ts
interface BindPreparedMaterialResourcesToRenderWorldOptions {
  readonly renderWorld: RenderWorld;
  readonly materials: PreparedMaterialStore;
}

interface BindPreparedMaterialResourcesToRenderWorldReport {
  readonly updated: number;
  readonly missing: number;
  readonly diagnostics: readonly RenderDiagnostic[];
}
```

The helper should:

1. Iterate active `RenderWorld` objects.
2. Look up the object's `packet.material` in `PreparedMaterialStore`.
3. Call `renderWorld.updateResourceBindings(renderId, { materialResourceKey })`
   with the prepared entry's `materialResourceKey` when present.
4. Leave missing entries as blocked draws with JSON-safe diagnostics.
5. Preserve any existing mesh resource bindings.

## Boundary Rules

- Use only string resource keys from prepared material metadata.
- Do not store prepared entries, source assets, material objects, WebGPU buffers,
  bind groups, texture/sampler resources, or app cache objects in `RenderWorld`.
- Do not mutate the `RenderSnapshot`; apply the snapshot first, then update
  render-world bindings.
- Do not treat missing material metadata as success. Keep draw readiness blocked
  until a material key is present.

## Tests

- Apply a snapshot with one material draw and no bindings; readiness is blocked
  for missing mesh and material resources.
- Prepare the material with `PreparedMaterialStore`, bind material resources, and
  verify readiness remains blocked only for the missing mesh resource.
- Bind a mesh resource key separately and verify the draw becomes ready.
- Verify the render world stores string material resource keys only.
- Verify missing prepared material entries produce JSON-safe diagnostics and do
  not clear existing mesh bindings.

## Non-Goals

- Do not bind WebGPU material buffers or bind groups into `RenderWorld`.
- Do not add renderer-owned texture/sampler resources to the render package.
- Do not change draw packet or `RenderSnapshot` shape.
- Do not implement automatic scheduling or an app facade change in this slice.

## Follow-Up Task Shape

```md
### task-next - Bind prepared material resource keys into render world

Category: `render-bridge`
Package/write-scope: `packages/render`, focused tests.
Reference anchor:
`docs/research/RENDER_WORLD_PREPARED_MATERIAL_BINDING_INTEGRATION_PLAN_2026_05_17.md`,
prepared material store facade, render-world resource binding placeholders, and
Bevy render-world prepared asset lookup patterns.

Acceptance criteria:

- A render package helper updates `RenderWorldObject.gpu.materialResourceKey`
  from prepared material facade entries.
- Tests prove blocked draws become ready through string resource keys once mesh
  and material bindings are present.
- `RenderSnapshot` remains immutable and WebGPU resources stay out of render
  world ownership.
```
