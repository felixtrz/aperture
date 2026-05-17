# StandardMaterial Texture Fidelity Diagnostics Plan - 2026-05-17

## Scope

Plan a narrow diagnostics/test slice for StandardMaterial texture fidelity.

This is a planning slice only. It does not change shader sampling, bind group
layouts, texture uploads, sampler creation, app routing, IBL, shadows, or broad
PBR behavior.

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `packages/render/src/materials/standard-texture-readiness.ts`
- `packages/render/src/materials/gltf-sampler.ts`
- `packages/render/src/materials/gltf-material.ts`
- `packages/render/src/rendering/extraction.ts`
- `packages/webgpu/src/webgpu/standard-shader.ts`
- `packages/webgpu/src/webgpu/standard-pipeline-descriptor.ts`
- `test/materials/standard-texture-readiness.test.ts`
- `test/materials/gltf-sampler.test.ts`
- `test/webgpu/standard-shader.test.ts`
- `references/engine/src/framework/parsers/glb-parser.js`
- `references/engine/src/platform/graphics/texture.js`
- `references/three.js/examples/jsm/loaders/GLTFLoader.js`
- `references/three.js/src/materials/MeshStandardMaterial.js`
- `references/three.js/src/textures/Texture.js`
- `references/three.js/src/renderers/webgl/WebGLTextures.js`

Common reference pattern:

- glTF base-color and emissive texture slots are treated as color/sRGB inputs.
- Metallic-roughness, normal, and occlusion slots are treated as linear/data
  inputs with slot-specific channel conventions.
- Sampler wrap/filter metadata is preserved and defaults to repeat plus linear
  mipmapped filtering when glTF omits sampler data.
- Higher UV sets and texture transforms are accepted as authoring data by mature
  engines, but Aperture currently renders only `TEXCOORD_0`/`TEXCOORD_1` and
  diagnoses transforms as unsupported.

## Current Aperture Surface

`createStandardMaterialTextureReadinessReport()` already validates the important
source-side fidelity inputs:

- texture field to semantic mapping:
  - `baseColorTexture` -> `base-color`;
  - `metallicRoughnessTexture` -> `metallic-roughness`;
  - `normalTexture` -> `normal`;
  - `occlusionTexture` -> `occlusion`;
  - `emissiveTexture` -> `emissive`;
- expected color spaces:
  - `baseColorTexture` and `emissiveTexture` require `srgb`;
  - metallic-roughness, normal, and occlusion accept `linear` or `data`;
- texture and sampler dependency status by field;
- supported texture coordinate sets `0` and `1`;
- unsupported texture transforms.

Extraction also adds `render.standardMaterialTexture.missingTexCoord1` when a
material uses `TEXCOORD_1` but the mesh does not provide that vertex attribute.
The WebGPU StandardMaterial shader path already samples the current MVP fields
and keeps IBL and shadows deferred.

## Selected Gap

The next implementation slice should add an aggregate, JSON-safe texture
fidelity diagnostics summary for existing StandardMaterial texture readiness
reports.

Reason:

- detailed readiness reports are already correct for debugging one material;
- dashboard, app diagnostics, and future GLB validation need a compact view that
  says which texture fields are blocked by sampler readiness, color-space
  mismatch, semantic mismatch, UV support, or transform support;
- the summary can cover sampler, color-space, and texture-field fidelity without
  changing render behavior or claiming unsupported PBR features are rendered.

## Proposed Helper Shape

Add a small helper near the WebGPU diagnostics summaries, for example:

```ts
export interface StandardMaterialTextureFidelityFieldSummary {
  readonly field: StandardMaterialTextureField;
  readonly slotCount: number;
  readonly readySlotCount: number;
  readonly blockedSlotCount: number;
}

export interface StandardMaterialTextureFidelityIssueSummary {
  readonly code: StandardMaterialTextureReadinessDiagnosticCode;
  readonly count: number;
}

export interface StandardMaterialTextureFidelitySummary {
  readonly materialCount: number;
  readonly readyMaterialCount: number;
  readonly blockedMaterialCount: number;
  readonly slotCount: number;
  readonly readySlotCount: number;
  readonly blockedSlotCount: number;
  readonly byField: readonly StandardMaterialTextureFidelityFieldSummary[];
  readonly byIssue: readonly StandardMaterialTextureFidelityIssueSummary[];
  readonly samplerIssueCount: number;
  readonly colorSpaceIssueCount: number;
  readonly semanticIssueCount: number;
  readonly texCoordIssueCount: number;
  readonly transformIssueCount: number;
}

export function createStandardMaterialTextureFidelitySummary(
  reports: readonly StandardMaterialTextureReadinessReportJsonValue[],
): StandardMaterialTextureFidelitySummary;
```

The helper should be aggregate-only. It should not include material keys,
texture keys, sampler keys, raw readiness reports, source assets, prepared
resources, or WebGPU handles.

## Deterministic Buckets

Use stable ordering:

1. `baseColorTexture`
2. `metallicRoughnessTexture`
3. `normalTexture`
4. `occlusionTexture`
5. `emissiveTexture`

Diagnostic-code buckets should be sorted lexicographically unless a local
diagnostics helper already establishes a stronger pattern.

## Focused Validation

Add tests that directly construct readiness JSON reports and assert:

- empty input returns zero counts and stable empty buckets;
- ready StandardMaterial slots are counted by field;
- sampler problems count `missingSamplerHandle` and `samplerNotReady`;
- color-space problems count `invalidColorSpace` without exposing texture keys;
- texture-field problems count `invalidSemantic`;
- UV and transform problems count `unsupportedTexCoord` and
  `unsupportedTextureTransform`;
- `JSON.stringify()` output does not include `material:`, `texture:`,
  `sampler:`, or GPU-resource-like handles.

Suggested commands:

- `pnpm exec vitest run test/webgpu/standard-material-texture-fidelity-summary.test.ts`
- `pnpm exec tsc --noEmit -p packages/webgpu/tsconfig.json`

## Non-Goals

- No shader sampling changes.
- No new texture fields.
- No IBL, shadows, environment maps, or broader PBR rewrite.
- No texture upload, sampler creation, bind group, or pipeline behavior changes.
- No app report wiring by default.
- No raw material, texture, sampler, GPU, or source asset handle exposure.

## Recommended Follow-Up

Proceed with `task-0983` as the implementation slice:

- add the aggregate StandardMaterial texture fidelity summary helper;
- export it from `@aperture-engine/webgpu`;
- cover sampler, color-space, semantic, UV, and transform bucket counts with
  focused tests;
- keep app/frame report wiring out of scope unless a later task adds an
  optional diagnostics surface.
