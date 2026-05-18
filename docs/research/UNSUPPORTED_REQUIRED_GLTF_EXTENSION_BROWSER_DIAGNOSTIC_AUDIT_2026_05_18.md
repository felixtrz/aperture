# Unsupported Required glTF Extension Browser Diagnostic Audit

Date: 2026-05-18

## Scope

Audit the `task-1245` unsupported required glTF material extension
browser/status diagnostic fixture.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/UNSUPPORTED_REQUIRED_GLTF_EXTENSION_DIAGNOSTIC_PLAN_AUDIT_2026_05_18.md`
- `examples/standard-gltf-texture.js`
- `packages/render/src/assets/gltf-asset-mapping.ts`
- `packages/render/src/materials/gltf-material.ts`
- `test/e2e/standard-gltf-texture.spec.ts`

## Findings

Pass. The fixture stays inside source glTF material mapping and JSON-safe
app/example status.

The new `unsupported-required-material-extension` scenario adds
`KHR_materials_clearcoat` as an unsupported required extension on the
glTF-shaped source material. Asset mapping now preserves `extensionName` in the
JSON-safe diagnostic details, which lets the browser test assert the specific
unsupported extension rather than only a generic diagnostic code.

The expected-failure path correctly treats invalid source registration as part
of the honest failure. The material is skipped, the mesh still registers, no
mesh draw is extracted, no pipeline keys are produced, and no draw call is
submitted. The render-side diagnostic remains the existing
`render.missingMaterialHandle`, which reflects the skipped invalid material
without adding a renderer-owned source-of-truth path.

The change does not alter WebGPU upload behavior, app route structure, IBL,
shadows, binary GLB loading, GLB viewer behavior, material-family routing, or
shader behavior.

## Validation

- `node --check examples/standard-gltf-texture.js`
- `pnpm exec vitest run test/materials/gltf-material.test.ts test/assets/gltf-asset-mapping.test.ts`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts -g "unsupported required material extensions"`
- `pnpm run build`
- `pnpm run lint`
- `pnpm test`

## Recommendation

Proceed to `task-1241` for tracker/backlog alignment after the diagnostics and
route cleanup run. Keep `task-1243` as the next concrete route summary cleanup
candidate, and use `task-1247` to choose the next post-extension route or
fidelity slice after alignment.
