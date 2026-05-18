# Unsupported Required glTF Extension Diagnostic Plan Audit

Date: 2026-05-18

## Scope

Audit the `task-1240` plan for an unsupported required glTF material extension
browser/status diagnostic.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/NEXT_STANDARD_MATERIAL_GLTF_FIDELITY_DIAGNOSTIC_PLAN_2026_05_18.md`
- `docs/research/STANDARD_MATERIAL_FORMAT_COLOR_SPACE_BROWSER_FIXTURE_AUDIT_2026_05_18.md`
- `packages/render/src/materials/gltf-material.ts`
- `test/materials/gltf-material.test.ts`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`

## Findings

Pass. The selected slice is narrow and aligns with the source-side glTF
material honesty path.

The mapper already emits `gltfMaterial.unsupportedRequiredExtension` as an
error when an unsupported extension such as `KHR_materials_clearcoat` appears in
`extensionsRequired`. Unit coverage already proves the source mapper behavior,
so the next useful slice is browser/status propagation through the existing
glTF-shaped example fixture.

The planned browser fixture should stay within asset mapping and expected
failure status:

- it should add the unsupported required extension to the glTF-shaped material
  source;
- it should assert `materialKey`, `field`, and `extensionName` context in the
  JSON-safe mapping diagnostics;
- it should avoid registering or drawing a misleading material after invalid
  mapping.

The plan does not require WebGPU upload changes, route structure changes, new
material families, IBL, shadows, binary GLB loading, GLB viewer behavior, or
shader behavior.

## Validation

- Documentation audit backed by the `task-1240` plan and existing glTF material
  mapper/unit-test references.

## Recommendation

Proceed to `task-1245`: add the unsupported required glTF material extension
browser/status diagnostic fixture.
