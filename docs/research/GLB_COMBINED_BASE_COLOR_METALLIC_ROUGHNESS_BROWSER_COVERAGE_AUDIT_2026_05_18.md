# GLB Combined Base-Color Metallic-Roughness Browser Coverage Audit — 2026-05-18

## Scope

Audited the `task-1426` implementation adding GLB-derived StandardMaterial
browser coverage for a material with both `baseColorTexture` and
`metallicRoughnessTexture`.

Reference anchors:

- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/NEXT_MATERIAL_ROUTE_OR_STANDARD_FOLLOW_UP_AFTER_GLB_MR_UV1_PLAN_2026_05_18.md`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`
- `references/bevy/crates/bevy_pbr/src/gltf.rs`
- `references/three.js/src/renderers/webgpu/utils/WebGPUTextureUtils.js`
- `references/engine/src/scene/materials/standard-material.js`

## Findings

- The fixture proves the combined StandardMaterial texture path through the
  browser app. Status now asserts two glTF texture/sampler mappings, two ready
  StandardMaterial texture slots, two created texture resources, two created
  sampler resources, one material buffer, and the combined
  `standard|baseColorTexture|metallicRoughnessTexture|opaque|back|less|none`
  pipeline key.
- Pixel/readback assertions are intentionally qualitative. The direct-light MVP
  shader changes the raw base-color texture result with metallic/roughness, so
  the test verifies non-clear, blue-dominant output instead of treating the
  base-color texel as the final shaded pixel.
- ECS authority and render extraction remain intact. The scenario authors
  glTF-shaped source material data, registers typed source assets, spawns ECS
  mesh/material components, and renders through the existing extracted snapshot
  and WebGPU app path.
- WebGPU ownership remains intact. Status assertions cover JSON-safe resource
  counts and pipeline keys without exposing raw GPU handles or making ECS own
  renderer resources.
- Scope stayed narrow. The implementation did not add binary GLB loading, GLB
  viewer behavior, IBL, shadows, route renames, broad PBR completeness, or
  non-built-in material rendering.

## Validation Reviewed

- `node --check examples/standard-gltf-texture.js`
- `pnpm run typecheck:test`
- `pnpm exec prettier --check examples/standard-gltf-texture.js test/e2e/standard-gltf-texture.spec.ts agent/BACKLOG.md agent/COMPLETED.md docs/research/NEXT_MATERIAL_ROUTE_OR_STANDARD_FOLLOW_UP_AFTER_GLB_MR_UV1_PLAN_2026_05_18.md docs/research/NEXT_MATERIAL_ROUTE_OR_STANDARD_FOLLOW_UP_AFTER_GLB_MR_UV1_PLAN_AUDIT_2026_05_18.md`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts -g "combined base-color and metallic-roughness"`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts`

## Recommendation

Mark `task-1426` and `task-1427` complete. Continue with `task-1428`: update
the public tracker for combined StandardMaterial texture browser coverage and
confirm the ready backlog remains filled.
