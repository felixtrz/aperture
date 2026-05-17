# Generic Textured Standard Prepared Route Audit - 2026-05-17

## Scope

Audit the expanded `StandardMaterial` prepared resource route after scalar,
base-color, metallic-roughness, normal, and occlusion/emissive texture-family
coverage.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/RENDER_ASSET_PREPARATION.md`
- `docs/DECISIONS.md`
- `docs/research/STANDARD_NORMAL_OCCLUSION_EMISSIVE_PREPARED_CACHE_PLAN_2026_05_17.md`
- `packages/webgpu/src/webgpu/prepared-standard-material-cache.ts`
- `packages/webgpu/src/webgpu/standard-app-frame-resources.ts`
- `packages/webgpu/src/webgpu/app-texture-sampler-resources.ts`
- `packages/webgpu/src/webgpu/standard-frame-resources.ts`
- `test/webgpu/prepared-standard-material-cache.test.ts`
- `test/webgpu/webgpu-app.test.ts`

## Findings

- All current Standard texture families now have a prepared group-2 resource
  path for the covered app-route shapes: base-color-only,
  metallic-roughness-only, normal-only, and occlusion/emissive-only
  combinations.
- Prepared Standard resources remain WebGPU-owned and renderer-derived. The
  helpers create material uniform buffers and group-2 material bind groups from
  ready source material data, source material versions, pipeline keys, group-2
  layout keys, texture/sampler source-version dependency segments, and prepared
  texture/sampler GPU resources.
- Source material, texture, and sampler assets remain authoritative in
  simulation/render asset collections. The WebGPU prepared cache stores only
  derived resource objects, logical resource keys, source-version metadata, and
  dependency key segments.
- Texture and sampler GPU resources remain separate dependencies prepared by
  `app-texture-sampler-resources.ts`; the Standard prepared material cache does
  not own texture upload policy, sampler creation policy, texture/sampler cache
  maps, source texture assets, or source sampler assets.
- Group-3 light resources remain frame-derived from `RenderSnapshot` light
  packets in `standard-frame-resources.ts`. No prepared Standard material cache
  key includes light buffer, light bind group, light layout, or light packet
  state.
- Normal-map tangent requirements remain outside material cache ownership. The
  normal prepared route keys material, texture, sampler, pipeline, and layout
  state only; tangent readiness remains in mesh/material readiness diagnostics
  and pipeline layout selection.
- JSON-safe app reports distinguish full frame-resource cache hits from
  prepared material reuse, prepared mesh reuse, texture/sampler reuse, and new
  resource creation. Tests exercise texture/sampler source-version invalidation
  without reading private cache maps or exposing raw GPU handles.
- The route still has two implementation shapes: a shared single-texture-family
  helper for base-color, metallic-roughness, and normal, plus a multi-family
  occlusion/emissive helper. This is not ownership drift, but the next
  material-family planning slice should decide whether to consolidate these
  into one texture-set helper before generalizing across material families.

## Follow-Up Guardrails

- `task-0839` should plan the generic material-family preparation handoff and
  explicitly address whether Standard's single-family and multi-family prepared
  helpers should be consolidated first.
- A future app-route task should add explicit occlusion-only and emissive-only
  WebGPU app regressions if those individual variants become important
  user-facing examples; direct helper tests already cover them.
- Generic material-family work must not move ECS entities, render snapshots,
  lights, texture upload state, or raw GPU resources into source material
  assets.

## Outcome

No boundary drift was found. The prepared Standard route now covers the current
texture-family proof path while preserving the ECS/render/WebGPU ownership
split: ECS/source assets are authoritative, rendering is derived, texture and
sampler resources are backend dependencies, group-2 material resources are
prepared WebGPU resources, and group-3 lights remain frame-derived.
