# Multiple Optional Extension Warning Status Audit

Date: 2026-05-18

## Scope

Audit the browser fixture that reports multiple unsupported optional glTF
material-extension warnings while rendering the base StandardMaterial path.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/OPTIONAL_EXTENSION_WARNING_AGGREGATION_OR_GLTF_FIDELITY_PLAN_2026_05_18.md`
- `packages/render/src/materials/gltf-material.ts`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`

## Findings

Pass. The fixture stays on the intended diagnostics boundary.

The `multiple-optional-material-extensions` scenario adds
`KHR_materials_clearcoat` and `KHR_materials_transmission` as optional material
extensions. The mapper emits one
`gltfMaterial.unsupportedOptionalExtension` warning for each extension, and the
browser status preserves both JSON-safe `field` and `extensionName` values.

Boundary checks:

- the material remains valid and renders as the base StandardMaterial path;
- no clearcoat, transmission, sheen, or physical-material rendering was added;
- no shader, pipeline, bind-group, route, IBL, shadow, binary GLB, or GLB viewer
  behavior changed;
- warning status remains JSON-safe and does not expose GPU handles.

## Recommendation

Run tracker/backlog alignment next so the public dashboard records the
multi-extension warning fixture and the ready backlog remains full.

## Validation

- `node --check examples/standard-gltf-texture.js`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts -g "multiple unsupported optional"`
