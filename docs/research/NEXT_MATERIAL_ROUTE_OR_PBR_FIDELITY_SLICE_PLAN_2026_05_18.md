# Next Material Route Or PBR Fidelity Slice Plan

Date: 2026-05-18

## Scope

Plan the next narrow material route or PBR fidelity slice after
StandardMaterial texture format/color-space diagnostics and environment-map
readiness reporting.

This is a planning slice. It does not implement browser fixtures, change WebGPU
upload behavior, add IBL, add shadows, parse binary GLB containers, or migrate
the material-family app route.

## References Inspected

- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/ARCHITECTURE.md`
- `docs/research/STANDARD_MATERIAL_COLOR_SPACE_FORMAT_DIAGNOSTICS_AUDIT_2026_05_18.md`
- `docs/research/ENVIRONMENT_MAP_READINESS_REPORT_AUDIT_2026_05_18.md`
- `docs/research/GENERIC_ROUTE_PREPARED_RESOURCE_PRESSURE_AUDIT_2026_05_18.md`
- `docs/research/STANDARD_MATERIAL_ROUTE_PREPARED_RESOURCE_CLEANUP_AUDIT_2026_05_18.md`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`

## Selected Slice

Add a browser/status regression for StandardMaterial texture
format/color-space diagnostics.

The source-side unit coverage now proves
`standardMaterialTexture.invalidColorSpaceFormat`, and the compact texture
fidelity summary groups it. The next useful vertical slice is to prove the same
diagnostic survives the app/example path used for glTF-shaped StandardMaterial
fixtures.

## Follow-Up Task

### task-1232 - Add StandardMaterial format/color-space browser diagnostic fixture

Category: `runtime-orchestration`
Package/write-scope: `examples/standard-gltf-texture.js` and
`test/e2e/standard-gltf-texture.spec.ts`.
Reference anchor:
`docs/research/NEXT_MATERIAL_ROUTE_OR_PBR_FIDELITY_SLICE_PLAN_2026_05_18.md`,
`packages/render/src/materials/standard-texture-readiness.ts`, and existing
StandardMaterial missing/loading/failed texture browser diagnostics.

Acceptance criteria:

- Add a glTF-shaped StandardMaterial scenario with a ready texture whose
  declared color space and texture format disagree about sRGB encoding.
- Browser status exposes `standardMaterialTexture.invalidColorSpaceFormat`
  through the existing JSON-safe status/diagnostics path.
- The scenario should not submit a misleading successful draw if texture
  readiness blocks the material.
- Playwright asserts the diagnostic code, material/texture field context, and
  absence of raw GPU handles.
- Do not change WebGPU upload behavior, app route structure, IBL, shadows,
  binary GLB loading, or material-family routing.

## Deferred Alternatives

- Generic material-family app route migration is still the larger architecture
  priority, but this smaller browser regression closes the source-diagnostic
  vertical slice first.
- Alpha/double-sided and transparent queue fidelity already have meaningful
  browser coverage, so they are not the next immediate diagnostic gap.
- IBL shader sampling, shadow maps, environment texture upload, and GLB viewer
  behavior remain deferred.
