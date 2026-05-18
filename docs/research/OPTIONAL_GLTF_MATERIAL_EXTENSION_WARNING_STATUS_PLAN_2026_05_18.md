# Optional glTF Material-Extension Warning Status Plan

Date: 2026-05-18

## Scope

Define the next narrow status contract for unsupported optional glTF material
extensions.

## References Inspected

- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/ARCHITECTURE.md`
- `packages/render/src/materials/gltf-material.ts`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`

## Current Shape

Required unsupported material extensions already have expected-failure browser
coverage. They block material registration and draw submission because glTF
requires them for correct interpretation.

Optional unsupported material extensions should be different. They should
produce warning diagnostics but still allow rendering when the base material is
otherwise supported.

## Proposed Fixture

Add a scenario such as `unsupported-optional-material-extension` using a
StandardMaterial base-color fixture with:

```js
extensions: {
  KHR_materials_clearcoat: {
  }
}
```

and without adding the extension to `extensionsRequired`.

Expected status:

- `gltfMaterial.unsupportedOptionalExtension` appears in asset mapping
  diagnostics with severity `warning`.
- Asset mapping remains valid.
- Material/texture/sampler registration succeeds.
- Extraction produces one mesh draw.
- Resources, pipeline, and draw calls are created normally.
- The warning remains JSON-safe and does not expose raw GPU handles or source
  texture bytes.

## Selected Follow-Up

Add `task-1304 — Add unsupported optional glTF material-extension warning
browser status`.

Category: `runtime-orchestration`

Package/write-scope:

- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`
- targeted material mapping tests only if a small assertion is needed.

Reference anchor:

- this plan;
- `packages/render/src/materials/gltf-material.ts`;
- `examples/standard-gltf-texture.js`;
- `test/e2e/standard-gltf-texture.spec.ts`.

Acceptance criteria:

- Add an unsupported optional material-extension scenario.
- Browser status reports `gltfMaterial.unsupportedOptionalExtension` as a
  warning while still rendering the base StandardMaterial.
- Playwright asserts successful registration, resource creation, pipeline
  creation, draw submission, and JSON-safe warning details.
- Do not add support for the optional extension, IBL, shadows, binary GLB
  loading, GLB viewer behavior, or route migration.

## Validation

Plan-only task. Validate with touched-file formatting and final
`git diff --check`.
