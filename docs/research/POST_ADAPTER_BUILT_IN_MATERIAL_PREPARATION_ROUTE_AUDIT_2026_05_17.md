# Post-Adapter Built-In Material Preparation Route Audit - 2026-05-17

## Scope

Audit the built-in material preparation route after moving unlit, Matcap, and
Standard app resource preparation behind the queued built-in material adapter
registry and adding prepared material cache summary counts.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/RENDER_ASSET_PREPARATION.md`
- `docs/research/GENERIC_BUILT_IN_MATERIAL_PREPARATION_BOUNDARY_AUDIT_2026_05_17.md`
- `docs/research/GENERIC_MATERIAL_FAMILY_PREPARATION_HANDOFF_PLAN_2026_05_17.md`
- `docs/research/RENDER_WORLD_PREPARED_MATERIAL_STORE_HANDOFF_PLAN_2026_05_17.md`
- `packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/prepared-app-material-resource.ts`
- `packages/webgpu/src/webgpu/app-texture-sampler-resources.ts`
- `packages/webgpu/src/webgpu/unlit-app-frame-resources.ts`
- `packages/webgpu/src/webgpu/matcap-app-frame-resources.ts`
- `packages/webgpu/src/webgpu/standard-app-frame-resources.ts`
- Bevy anchors:
  - `references/bevy/crates/bevy_render/src/render_asset.rs`
  - `references/bevy/examples/shader_advanced/manual_material.rs`

## Findings

No architecture drift found in the adapter-driven built-in material preparation
route.

- Source mesh, material, texture, and sampler assets remain authoritative in
  `AssetRegistry`/typed render asset collections. The adapter route consumes
  source handles and source-version cache keys, but does not mutate source
  assets.
- `RenderSnapshot` remains immutable frame input. The single-material app route
  now creates a queue-item-shaped adapter input from the first draw packet, but
  it does not write into the snapshot or add renderer-owned state to packets.
- WebGPU resources remain backend-owned. Material buffers, bind groups, texture
  resources, sampler resources, pipelines, layouts, and light buffers all stay
  in `@aperture-engine/webgpu`.
- Texture and sampler GPU resources remain outside prepared material cache
  ownership. They are prepared through app texture/sampler resource helpers and
  passed into family-specific material resource preparation as dependencies.
- Standard group-3 light resources remain frame-derived. The Standard material
  adapter passes `lightLayout` into frame resource creation, but prepared
  material cache keys and prepared material resources still cover only group-2
  material resources.
- Public app reports remain JSON-safe. Prepared material cache summary counts
  expose family entry counts only; they do not expose cache maps, raw buffers,
  bind groups, textures, samplers, or descriptors.
- The adapter registry now selects family resource preparation through a table
  (`unlit`, `matcap`, `standard`) instead of switching inside the registry
  factory. The app single-material path and queued path both use the same
  adapter surface for texture/sampler preparation and frame resource creation.

## Coupling Notes

- The pre-existing multi-material scalar unlit path still bypasses the adapter
  table because it batches several untextured unlit materials for one mesh. It
  is not new drift from the adapter work, but it should stay narrow. If generic
  material-family queueing grows, this path should either become a generic queue
  optimization or be retired.
- `WebGpuAppResourceCache` still stores prepared unlit, Matcap, and Standard
  material caches as separate fields. This is the intended target of
  `task-0851`, which should introduce a WebGPU-private prepared built-in
  material store container before any broader render-world migration.

## Validation Covering The Audit

- `pnpm exec tsc --noEmit -p packages/webgpu/tsconfig.json`
- `pnpm exec vitest run test/webgpu/built-in-material-app-resource-adapter.test.ts test/webgpu/webgpu-app.test.ts`
- `pnpm exec vitest run test/webgpu/prepared-app-material-resource.test.ts test/webgpu/webgpu-app.test.ts`

## Follow-Up

Proceed to `task-0850` for fallback diagnostics before the store-container
handoff. Keep the diagnostics scoped to unexpected prepared material helper
failures; expected skipped routes should remain silent.
