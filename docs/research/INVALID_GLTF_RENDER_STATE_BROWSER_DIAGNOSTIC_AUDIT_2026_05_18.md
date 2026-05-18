# Invalid glTF Render-State Browser Diagnostic Audit

Date: 2026-05-18

## Scope

Audit the `task-1251` invalid glTF render-state browser/status diagnostic
fixture.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/NEXT_POST_EXTENSION_SLICE_PLAN_AUDIT_2026_05_18.md`
- `packages/render/src/assets/gltf-asset-mapping.ts`
- `packages/render/src/materials/gltf-material.ts`
- `examples/standard-gltf-texture.js`
- `test/assets/gltf-asset-mapping.test.ts`
- `test/e2e/standard-gltf-texture.spec.ts`

## Findings

Pass. The fixture stays in source mapping and JSON-safe example status.

The new `invalid-render-state` scenario uses invalid glTF material
`alphaMode`, `alphaCutoff`, and `doubleSided` values. The material mapper still
owns validation, and the asset-mapping report now preserves each diagnostic's
JSON-safe scalar `value` field. That field is limited to string, number,
boolean, or null diagnostic values; it does not expose raw source objects,
texture bytes, sampler objects, WebGPU handles, backend resource keys, or other
renderer-owned state.

The browser fixture follows the same honest-failure shape as unsupported
required extensions:

- source mapping is invalid;
- material registration is skipped;
- mesh registration can still succeed;
- render extraction reports the missing material handle;
- no mesh draw is extracted;
- no pipeline keys are created;
- no draw call is submitted.

The change does not add shader behavior, WebGPU upload behavior, app route
migration, IBL, shadows, binary GLB loading, GLB viewer behavior, or new
material families.

## Recommendation

Continue with `task-1253` to plan the next texture-binding fidelity or
route-migration slice. The most likely next implementation remains unresolved
glTF texture-binding browser diagnostics, but the plan should still compare it
against route migration and prepared-resource/cache work before selecting.

## Validation

- `pnpm exec vitest run test/materials/gltf-material.test.ts test/assets/gltf-asset-mapping.test.ts`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts -g "invalid render-state"`
- `pnpm run build`
- `pnpm run lint`
- `pnpm test`
