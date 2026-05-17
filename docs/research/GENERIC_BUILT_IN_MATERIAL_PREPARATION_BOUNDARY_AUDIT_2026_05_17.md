# Generic Built-In Material Preparation Boundary Audit - 2026-05-17

## Scope

Audit the current generic built-in prepared material work after adding Matcap
prepared resources and normalizing unlit, Matcap, and Standard app-route
prepared material use results.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/RENDER_ASSET_PREPARATION.md`
- `docs/research/GENERIC_MATERIAL_FAMILY_PREPARATION_HANDOFF_PLAN_2026_05_17.md`
- `packages/webgpu/src/webgpu/prepared-unlit-material-cache.ts`
- `packages/webgpu/src/webgpu/prepared-matcap-material-cache.ts`
- `packages/webgpu/src/webgpu/prepared-standard-material-cache.ts`
- `packages/webgpu/src/webgpu/prepared-app-material-resource.ts`
- `packages/webgpu/src/webgpu/unlit-app-frame-resources.ts`
- `packages/webgpu/src/webgpu/matcap-app-frame-resources.ts`
- `packages/webgpu/src/webgpu/standard-app-frame-resources.ts`
- `packages/webgpu/src/webgpu/app.ts`

## Findings

No boundary drift found.

- Source material, texture, and sampler assets remain authoritative in
  `AssetRegistry` and typed render asset collections.
- Prepared material cache keys are derived from source material handle/version,
  pipeline/layout key, and ordered texture/sampler source-version dependency
  segments.
- WebGPU buffers and bind groups are owned only by `@aperture-engine/webgpu`.
  The `@aperture-engine/render`, `@aperture-engine/simulation`, and
  `@aperture-engine/core` packages still do not import WebGPU resources.
- Texture and sampler GPU resources remain separate app-prepared dependencies
  passed into material preparation; prepared material caches do not create or
  own texture/sampler GPU resources.
- Standard group-3 light resources remain frame-derived and outside prepared
  material cache ownership.
- `RenderSnapshot` remains the frame boundary. Prepared material helpers consume
  ready source asset versions and prepared texture/sampler resources; they do
  not mutate ECS state or render snapshots.
- Public app reports remain JSON-safe and continue to expose counters rather
  than raw GPU handles.

## Follow-Up

The next implementation slice can proceed to `task-0845`: move built-in
material preparation selection behind the existing adapter registry. The
normalized `PreparedAppMaterialResourceUse<T>` shape is now available as the
common internal status/resource surface for that work.

Guardrails for that slice:

- Keep family-specific prepared resource types strongly typed internally.
- Keep texture/sampler resource preparation outside material cache helpers.
- Keep app reports stable while moving selection logic behind the adapter table.
- Do not introduce a public material plugin API in this step.
