# StandardMaterial Format/Color-Space Browser Fixture Audit

Date: 2026-05-18

## Scope

Audit the `task-1232` browser/status fixture for
`standardMaterialTexture.invalidColorSpaceFormat`.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/research/NEXT_MATERIAL_ROUTE_OR_PBR_FIDELITY_SLICE_PLAN_2026_05_18.md`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`
- `packages/render/src/materials/standard-texture-readiness.ts`

## Findings

Pass. The browser fixture stays within the selected diagnostics/status scope.

The new `base-color-format-color-space-mismatch` scenario starts from the
existing glTF-shaped StandardMaterial texture fixture, then rewrites the ready
source texture asset to keep `colorSpace: "srgb"` while using
`format: "rgba8unorm"`. This exercises the same source-side readiness check as
the unit tests through the app/example path.

The browser status exposes the diagnostic through existing JSON-safe fields:

- `standardTexture.readiness.diagnostics` includes
  `standardMaterialTexture.invalidColorSpaceFormat` with texture field,
  texture key, actual color space, expected sRGB format class, and actual
  format;
- extraction emits `render.standardMaterialTexture.invalidColorSpaceFormat`;
- no mesh draw, draw package, pipeline key, or diagnostics summary is emitted
  for the blocked material.

The change does not add WebGPU upload behavior, app route structure changes,
IBL, shadows, binary GLB loading, material-family routing, source asset
mutation outside the fixture setup, or a renderer-owned source-of-truth object.

## Validation

- `node --check examples/standard-gltf-texture.js`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts -g "format/color-space mismatches"`

## Recommendation

Proceed to `task-1234`: plan a narrow generic material route cleanup. Keep IBL,
shadows, binary GLB viewer behavior, and broad material-family rewrites
deferred.
