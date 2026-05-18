# Invalid glTF Texture Scalar Browser Diagnostic Audit

Date: 2026-05-18

## Scope

Audit the `task-1322` invalid glTF texture scalar browser diagnostic
implementation against the selected plan from `task-1320` and the plan audit
from `task-1321`.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/DECISIONS.md`
- `docs/research/NEXT_POST_DIAGNOSTICS_MATERIAL_OR_ROUTE_SLICE_PLAN_2026_05_18.md`
- `docs/research/NEXT_POST_DIAGNOSTICS_MATERIAL_OR_ROUTE_SLICE_PLAN_AUDIT_2026_05_18.md`
- `packages/render/src/materials/gltf-material.ts`
- `packages/render/src/assets/gltf-asset-mapping.ts`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`
- `references/bevy/crates/bevy_pbr/src/material.rs`
- `references/bevy/crates/bevy_render/src/render_asset.rs`

Bevy's material and render-asset references reinforce the same boundary used by
this slice: source material validation and asset preparation stay ahead of GPU
resource creation, and invalid source data should not become renderer-owned
prepared state.

## Findings

Pass. The implementation satisfies the selected acceptance criteria.

- The example adds an `invalid-texture-scalar` scenario that authors
  `occlusionTexture.strength` as `"strong"`.
- The existing glTF material mapper reports `gltfMaterial.invalidField` for
  `occlusionTexture.strength`, preserves the malformed `value`, and marks the
  asset mapping invalid.
- Registration remains invalid for the material, so the renderable entity keeps
  its ECS-authored material handle but extraction reports
  `render.missingMaterialHandle` instead of producing a mesh draw.
- Browser coverage asserts JSON-safe status, no material registration, no mesh
  draws, no texture/sampler/material/bind-group resources, no pipelines, and no
  draw submissions.

Boundary checks:

- ECS authority is preserved; the fixture is authored through ECS components and
  invalid source asset mapping prevents renderable material state from being
  registered.
- Render extraction remains a derived boundary and reports the missing material
  handle rather than querying or repairing renderer state.
- WebGPU remains backend-owned; invalid source data does not create GPU
  resources, pipelines, bind groups, or draw commands.
- No app-level custom material route, binary GLB loading, IBL, shadows, or GLB
  viewer behavior was added.

## Recommendation

Run tracker/backlog alignment next so the public status and ready queue reflect
the completed invalid texture scalar diagnostic and this audit.

## Validation

- Documentation audit backed by the `task-1322` targeted browser test:
  `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts -g "invalid texture scalar"`
