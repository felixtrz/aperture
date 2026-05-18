# GLB Metallic-Roughness UV1 Transform Browser Coverage Audit — 2026-05-18

## Scope

Audited the `task-1421` implementation adding GLB-derived StandardMaterial
browser coverage for a metallic-roughness texture sampled through `TEXCOORD_1`
with `KHR_texture_transform`.

Reference anchors:

- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/NEXT_MATERIAL_ROUTE_OR_STANDARD_FOLLOW_UP_AFTER_APP_ADAPTER_REGISTRY_PLAN_2026_05_18.md`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`
- `references/bevy/crates/bevy_pbr/src/gltf.rs`
- `references/three.js/src/renderers/webgpu/utils/WebGPUTextureUtils.js`
- `references/engine/src/scene/materials/standard-material.js`

## Findings

- The fixture proves the intended intersection of metallic-roughness texture
  sampling, `TEXCOORD_1`, and a supported texture transform. The status asserts
  `texCoord: 1`, the expected transform, the UV1 mesh layout, and a
  `standard|metallicRoughnessTexture|uv1|opaque|back|less|none` pipeline key.
- Pixel/readback coverage compares the transformed UV1 sample against an
  otherwise equivalent untransformed UV1 control. This makes the test sensitive
  to the transform affecting the sampled metallic/roughness channels, not only
  to status metadata.
- ECS authority and render extraction remain intact. The scenario authors glTF
  source material data, registers source texture/sampler/mesh/material assets,
  spawns ECS mesh/material components, and renders through the existing
  extracted snapshot path.
- WebGPU ownership remains intact. The fixture does not store GPU handles in ECS
  or status JSON; renderer-owned texture, sampler, material buffer, bind group,
  pipeline, and readback resources stay behind the WebGPU app facade.
- Scope stayed narrow. The implementation did not add GLB viewer behavior, IBL,
  shadows, route renames, non-built-in material rendering, or broader PBR
  completeness claims.

## Validation Reviewed

- `node --check examples/standard-gltf-texture.js`
- `pnpm run typecheck:test`
- `pnpm exec prettier --check examples/standard-gltf-texture.js test/e2e/standard-gltf-texture.spec.ts`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts -g "transformed metallic-roughness through TEXCOORD_1"`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts`

## Recommendation

Mark `task-1421` and `task-1422` complete. Continue with
`task-1423`: audit public tracker/backlog alignment and update the tracker if
the new browser coverage materially changes public status.
