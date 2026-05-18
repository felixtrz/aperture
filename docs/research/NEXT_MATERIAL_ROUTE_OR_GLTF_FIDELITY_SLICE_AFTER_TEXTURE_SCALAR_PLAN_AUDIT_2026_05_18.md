# Next Material Route Or glTF Fidelity Slice After Texture Scalar Plan Audit

Date: 2026-05-18

## Scope

Audit the plan that selected an invalid glTF vector/color factor browser
diagnostic as the next implementation slice.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/NEXT_MATERIAL_ROUTE_OR_GLTF_FIDELITY_SLICE_AFTER_TEXTURE_SCALAR_PLAN_2026_05_18.md`
- `docs/research/INVALID_GLTF_TEXTURE_SCALAR_BROWSER_DIAGNOSTIC_AUDIT_2026_05_18.md`
- `packages/render/src/materials/gltf-material.ts`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`

## Findings

Pass. The selected follow-up is concrete enough for one focused run and stays on
the render-bridge diagnostics surface.

The invalid vector/color fixture should exercise existing glTF material mapper
validation for `pbrMetallicRoughness.baseColorFactor`. That mapper already emits
`gltfMaterial.invalidField` with the offending field and JSON-safe value data
when the value is not a four-number tuple, so the implementation should be able
to use the same browser expected-failure path as the recent scalar diagnostics.

Boundary checks:

- ECS remains authoritative; the fixture should still author a normal
  renderable entity through ECS components.
- Invalid source asset mapping should prevent material registration and prepared
  resource creation.
- Render extraction should report the missing material handle instead of
  creating a renderer-owned fallback.
- WebGPU should create no material/texture/sampler/bind-group resources,
  pipelines, or draw work for the invalid material.
- App-level non-built-in material routing, binary GLB loading, IBL, shadows,
  GLB viewer behavior, and new rendered material behavior remain deferred.

## Recommendation

Implement `task-1327` next.

## Validation

- Documentation-only audit; covered by final formatting and diff checks.
