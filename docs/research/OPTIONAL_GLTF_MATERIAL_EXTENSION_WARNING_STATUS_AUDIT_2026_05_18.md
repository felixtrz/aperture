# Optional glTF Material-Extension Warning Status Audit

Date: 2026-05-18

## Scope

Audit the unsupported optional glTF material-extension warning browser fixture.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/OPTIONAL_GLTF_MATERIAL_EXTENSION_WARNING_STATUS_PLAN_2026_05_18.md`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`
- `packages/render/src/materials/gltf-material.ts`

## Findings

Pass. The fixture correctly models optional-extension warnings as
success-with-warning, not expected failure.

The `unsupported-optional-material-extension` scenario adds
`KHR_materials_clearcoat` without listing it in `extensionsRequired`. Browser
status reports `gltfMaterial.unsupportedOptionalExtension` with warning
severity, while asset mapping, registration, extraction, resource creation,
pipeline creation, and draw submission still succeed for the base
StandardMaterial.

Boundary checks:

- no clearcoat/PBR feature support was added;
- no shader behavior changed;
- no route migration or material-family extension behavior changed;
- no binary GLB loading, IBL, shadows, or GLB viewer behavior changed;
- warning status remains JSON-safe.

## Recommendation

Next route-oriented work should cover unregistered route-key app diagnostics so
Decision 0010 has app-level failure coverage before any non-built-in route
implementation.

## Validation

- `node --check examples/standard-gltf-texture.js`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts -g "unsupported optional"`
