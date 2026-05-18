# Next StandardMaterial glTF Fidelity Diagnostic Plan

Date: 2026-05-18

## Scope

Plan the next narrow StandardMaterial/glTF fidelity diagnostic after route
report stale-state coverage.

This is a planning slice. It does not implement a browser fixture, change
WebGPU upload behavior, add IBL, add shadows, parse binary GLB containers, add
GLB viewer behavior, or migrate material-family app routes.

## References Inspected

- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/ARCHITECTURE.md`
- `docs/research/STANDARD_MATERIAL_FORMAT_COLOR_SPACE_BROWSER_FIXTURE_AUDIT_2026_05_18.md`
- `docs/research/GENERIC_ROUTE_SUMMARY_STALE_STATE_REGRESSION_AUDIT_2026_05_18.md`
- `packages/render/src/materials/gltf-material.ts`
- `test/materials/gltf-material.test.ts`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`

## Candidates Compared

### Unsupported Required Material Extension Browser Diagnostic

The glTF material mapper already diagnoses unsupported required material
extensions with `gltfMaterial.unsupportedRequiredExtension`. Existing unit
coverage proves the mapper behavior for `KHR_materials_clearcoat`, but the
browser fixture path does not yet prove that this source-side mapping error is
reported through example status before registration or rendering proceeds.

This is a good fidelity diagnostic because glTF requires unsupported required
extensions to block honest rendering. It is source-side, JSON-safe, and does not
require new shader behavior.

### Additional Sampler Or Texture Compatibility Diagnostic

Sampler/color-space/format diagnostics now have stronger source, summary, and
browser coverage. Another sampler diagnostic would be useful eventually, but it
would be less valuable than proving unsupported required glTF material
extensions block the example path honestly.

### Route Summary Group Cleanup

Route report shell stale-state coverage is in place, and route summary group
coverage remains available as `task-1243`. It is not the best immediate
StandardMaterial/glTF fidelity follow-up because it does not exercise source
glTF material honesty.

## Selected Slice

Add a browser/status fixture for unsupported required glTF material extensions.

The fixture should use an existing StandardMaterial glTF-shaped scenario, add an
unsupported required extension such as `KHR_materials_clearcoat`, and assert
that the app/example status exposes `gltfMaterial.unsupportedRequiredExtension`
without registering a misleading renderable material or submitting draws.

## Follow-Up Task

### task-1245 - Add unsupported required glTF material extension browser diagnostic

Category: `runtime-orchestration`
Package/write-scope: `examples/standard-gltf-texture.js` and
`test/e2e/standard-gltf-texture.spec.ts`.
Reference anchor:
`docs/research/NEXT_STANDARD_MATERIAL_GLTF_FIDELITY_DIAGNOSTIC_PLAN_2026_05_18.md`,
`packages/render/src/materials/gltf-material.ts`, and existing expected-failure
glTF texture browser fixtures.

Acceptance criteria:

- Add a glTF-shaped StandardMaterial scenario with an unsupported required
  material extension, for example `KHR_materials_clearcoat`.
- Browser status exposes `gltfMaterial.unsupportedRequiredExtension` with
  `materialKey`, `field`, and `extensionName` context through the existing
  JSON-safe status path.
- The scenario does not register or draw a misleading StandardMaterial when
  material mapping is invalid.
- Playwright asserts the mapping diagnostic, expected failure status, no draw
  submission, and absence of raw GPU handles.
- Do not change WebGPU upload behavior, app route structure, IBL, shadows,
  binary GLB loading, GLB viewer behavior, or material-family routing.

## Deferred Alternatives

- Optional unsupported material extensions can remain warnings until a separate
  fixture proves warning-only behavior.
- Route summary group clean-after-failed coverage remains available as a small
  architecture cleanup.
- IBL, shadows, binary GLB loading, and GLB viewer behavior remain deferred.
