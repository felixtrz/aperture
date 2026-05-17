# StandardMaterial Texture Semantic/Color-Space Readiness Plan - 2026-05-17

## Scope

Plan the smallest follow-up for StandardMaterial texture semantic and
color-space readiness after the broader diagnostics and fidelity-summary work.

This slice does not change shader sampling, texture upload, sampler creation,
bind-group layouts, app report defaults, GLB material import, IBL, shadows, or
pipeline behavior.

## References Inspected

- `packages/render/src/materials/standard-texture-readiness.ts`
- `packages/render/src/rendering/extraction.ts`
- `packages/render/src/rendering/snapshot.ts`
- `packages/webgpu/src/webgpu/standard-material-texture-fidelity-summary.ts`
- `test/materials/standard-texture-readiness.test.ts`
- `test/rendering/extraction.test.ts`
- `test/webgpu/standard-material-texture-fidelity-summary.test.ts`
- `docs/research/STANDARD_MATERIAL_GLTF_PBR_TEXTURE_AUDIT_2026_05_17.md`
- `docs/research/STANDARD_MATERIAL_TEXTURE_FIDELITY_DIAGNOSTICS_PLAN_2026_05_17.md`

## Current State

`createStandardMaterialTextureReadinessReport()` already validates the glTF
slot expectations:

- `baseColorTexture` and `emissiveTexture` require color/sRGB textures.
- `metallicRoughnessTexture`, `normalTexture`, and `occlusionTexture` accept
  linear/data textures.
- Every ready texture slot records expected and actual semantic/color-space
  metadata in JSON-safe readiness slots and diagnostics.

`createStandardMaterialTextureFidelitySummary()` already aggregates the detailed
readiness reports without material, texture, sampler, source, prepared-resource,
or GPU handles.

## Selected Slice

The implementation gap is at render extraction: extraction promotes readiness
diagnostics into `RenderSnapshot.diagnostics`, but it drops the JSON-safe
expected/actual semantic and color-space fields. The next slice should preserve
those fields on `RenderDiagnostic` and cover the promotion in extraction tests.

This keeps the renderer's behavior unchanged while making blocked snapshot
diagnostics as actionable as the source readiness report.

## Non-Goals

- Do not add a new readiness helper.
- Do not expose source texture payloads, sampler objects, prepared resources, or
  GPU/backend handles.
- Do not add default app-frame summary wiring.
- Do not treat GLB material import as ready.

## Follow-Up

Proceed with a narrow render-bridge implementation:

- add optional `expectedSemantic`, `actualSemantic`, `expectedColorSpaces`, and
  `actualColorSpace` fields to `RenderDiagnostic`;
- copy those fields from StandardMaterial texture-readiness diagnostics during
  extraction;
- update focused extraction coverage and run targeted render validation.
