# Invalid glTF Texture-Info Browser Diagnostic Audit

Date: 2026-05-18

## Scope

Audit the `task-1259` invalid glTF texture-info browser/status diagnostic
fixture.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/NEXT_ROUTE_PREPARED_OR_GLTF_FIDELITY_PLAN_AUDIT_2026_05_18.md`
- `packages/render/src/assets/gltf-asset-mapping.ts`
- `packages/render/src/materials/gltf-material.ts`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`

## Findings

Pass. The fixture stays source-mapping/status-side and does not add
renderer-owned source repair or WebGPU upload behavior.

The `invalid-texture-info` scenario uses malformed base-color texture-info
fields: a non-numeric `index` and `texCoord`. The material mapper reports
`gltfMaterial.invalidTextureInfo` diagnostics with stable material, field, slot,
and scalar value context. Because the texture index is malformed, the asset
mapping layer does not plan texture or sampler source assets for this scenario.

The browser status proves the expected no-draw path:

- source material mapping is invalid;
- material registration is skipped;
- mesh source registration still succeeds;
- extraction reports the missing material handle;
- no mesh draw is extracted;
- no pipeline keys are created;
- no draw call is submitted.

JSON status remains free of raw source texture objects, texture bytes, sampler
objects, WebGPU handles, and backend resource handles.

## Recommendation

Use `task-1261` to check tracker/backlog alignment after the cluster of glTF
diagnostic fixtures. After that, return to planning before additional
implementation so the next slice can choose between route migration,
prepared-resource/cache reporting, and remaining StandardMaterial/glTF
diagnostics.

## Validation

- `node --check examples/standard-gltf-texture.js`
- `pnpm exec vitest run test/assets/gltf-asset-mapping.test.ts test/materials/gltf-material.test.ts`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts -g "invalid texture-info"`
