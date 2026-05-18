# Invalid glTF Vector Factor Browser Diagnostic Audit

Date: 2026-05-18

## Scope

Audit the `task-1327` invalid glTF vector/color factor browser diagnostic
implementation against the selected plan from `task-1325` and the plan audit
from `task-1326`.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/DECISIONS.md`
- `docs/research/NEXT_MATERIAL_ROUTE_OR_GLTF_FIDELITY_SLICE_AFTER_TEXTURE_SCALAR_PLAN_2026_05_18.md`
- `docs/research/NEXT_MATERIAL_ROUTE_OR_GLTF_FIDELITY_SLICE_AFTER_TEXTURE_SCALAR_PLAN_AUDIT_2026_05_18.md`
- `packages/render/src/materials/gltf-material.ts`
- `packages/render/src/assets/gltf-asset-mapping.ts`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`

## Findings

Pass. The implementation satisfies the selected acceptance criteria.

- The example adds an `invalid-vector-factor` scenario that authors
  `pbrMetallicRoughness.baseColorFactor` as `"hot-pink"`.
- The existing glTF material mapper reports `gltfMaterial.invalidField` for
  `pbrMetallicRoughness.baseColorFactor`, preserves the malformed JSON-safe
  `value`, and marks asset mapping invalid.
- Registration writes only the mesh, leaves the material unregistered, and keeps
  the renderable entity authored through ECS mesh/material components.
- Browser coverage asserts JSON-safe status, invalid material registration, no
  mesh draws, no texture/sampler/material/bind-group resources, no pipelines,
  and no draw submissions.

Boundary checks:

- ECS authority is preserved; invalid source data does not create a renderer
  fallback material.
- Render extraction remains a derived boundary and reports
  `render.missingMaterialHandle`.
- WebGPU remains backend-owned and receives no prepared resources or draw work
  for the invalid material.
- App-level non-built-in material routing, binary GLB loading, IBL, shadows,
  GLB viewer behavior, and new material rendering behavior remain deferred.

## Recommendation

Run tracker/backlog alignment next so the public status reflects the invalid
vector factor diagnostic and the ready queue remains sufficiently full.

## Validation

- `node --check examples/standard-gltf-texture.js`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts -g "invalid vector"`
