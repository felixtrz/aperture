# Unresolved glTF Texture-Binding Browser Diagnostic Audit

Date: 2026-05-18

## Scope

Audit the `task-1255` unresolved glTF texture-binding browser/status diagnostic
fixture.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/NEXT_TEXTURE_BINDING_OR_ROUTE_MIGRATION_PLAN_AUDIT_2026_05_18.md`
- `packages/render/src/assets/gltf-asset-mapping.ts`
- `packages/render/src/materials/gltf-material.ts`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`

## Findings

Pass. The fixture stays source-mapping/status-side and does not add
renderer-owned source repair or WebGPU upload behavior.

The `unresolved-texture-binding` scenario authors a base-color texture reference
whose texture asset cannot be planned because the source image is missing. The
asset-mapping report surfaces both the texture-layer
`gltfTexture.malformedImage` diagnostic and the material-layer
`gltfMaterial.unresolvedTextureBinding` diagnostic with stable material, field,
slot, dependency-kind, and texture-index context.

The expected-failure browser path remains honest:

- invalid source texture/material mapping prevents texture, sampler, and
  material registration;
- mesh source registration still succeeds;
- extraction reports the missing material handle;
- no mesh draw is extracted;
- no pipeline keys are created;
- no draw call is submitted.

JSON status remains free of raw texture bytes, sampler objects, WebGPU handles,
and backend resource handles. The optional StandardMaterial texture readiness
status reports the missing material handle rather than attempting renderer-side
source repair.

## Recommendation

Return to planning before more implementation. The next useful comparison should
weigh one route-migration step against one prepared-resource/cache-reporting
step and one remaining StandardMaterial/glTF fidelity diagnostic.

## Validation

- `node --check examples/standard-gltf-texture.js`
- `pnpm exec vitest run test/assets/gltf-asset-mapping.test.ts test/materials/gltf-material.test.ts`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts -g "unresolved texture bindings"`
