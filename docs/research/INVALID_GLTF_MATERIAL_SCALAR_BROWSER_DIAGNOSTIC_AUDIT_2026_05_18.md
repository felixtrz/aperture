# Invalid glTF Material Scalar Browser Diagnostic Audit

Date: 2026-05-18

## Scope

Audit the invalid StandardMaterial scalar-factor browser diagnostic fixture.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/NEXT_ROUTE_BOUNDARY_OR_STANDARD_MATERIAL_FIDELITY_PLAN_2026_05_18.md`
- `docs/research/NEXT_ROUTE_BOUNDARY_OR_STANDARD_MATERIAL_FIDELITY_PLAN_AUDIT_2026_05_18.md`
- `packages/render/src/materials/gltf-material.ts`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`

## Findings

Pass. The fixture satisfies the selected acceptance criteria and stays within
the render-bridge diagnostics boundary.

The `invalid-material-scalar` scenario sets
`pbrMetallicRoughness.metallicFactor` to a string. Browser status reports
`gltfMaterial.invalidField` with the malformed field and value, asset mapping is
invalid, registration stops before material/texture/sampler writes, extraction
emits no mesh draws, and no GPU resources or draw calls are created.

Boundary checks:

- no new material rendering behavior was added;
- no source asset or prepared-resource route contract changed;
- no binary GLB loading, IBL, shadows, or GLB viewer behavior changed;
- diagnostics remain JSON-safe and preserve actionable field/value data.

## Recommendation

Run tracker/backlog alignment next so the public dashboard reflects the invalid
scalar diagnostic and the ready backlog remains full.

## Validation

- `node --check examples/standard-gltf-texture.js`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts -g "invalid material scalar"`
