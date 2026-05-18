# StandardMaterial Texture-Transform Diagnostics Audit

Date: 2026-05-18

## Scope

Audit the browser diagnostic boundary after adding the transformed UV1 and
transformed non-base-color GLB-shaped fixtures.

This checks that successful base-color transform support, transformed UV1
unsupported diagnostics, transformed non-base-color unsupported diagnostics, and
missing `TEXCOORD_1` diagnostics stay distinct.

## References Inspected

- `docs/research/STANDARD_MATERIAL_TEXTURE_TRANSFORM_ROTATION_SUPPORT_AUDIT_2026_05_18.md`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`
- `packages/render/src/materials/standard-texture-readiness.ts`
- `packages/render/src/rendering/extraction.ts`

## Findings

The current fixture matrix separates the relevant outcomes:

- `base-color-transform-sampling` renders a base-color `TEXCOORD_0`
  offset/scale transform and asserts no diagnostics.
- `base-color-transform-rotation-sampling` renders a base-color `TEXCOORD_0`
  rotation transform and compares the sampled texel against untransformed and
  offset/scale-only colors.
- `base-color-uv1` renders an untransformed base-color `TEXCOORD_1` binding with
  a mesh layout containing `TEXCOORD_1`.
- `base-color-uv1-missing` authors an untransformed base-color `TEXCOORD_1`
  binding against a UV0-only mesh and reports
  `render.standardMaterialTexture.missingTexCoord1`.
- `base-color-uv1-transform` authors a transformed base-color `TEXCOORD_1`
  binding with a mesh layout containing `TEXCOORD_1` and reports
  `render.standardMaterialTexture.unsupportedTextureTransform`.
- `metallic-roughness-transform` authors a transformed
  `metallicRoughnessTexture` on `TEXCOORD_0` and reports
  `render.standardMaterialTexture.unsupportedTextureTransform`.

The transformed UV1 and transformed non-base-color paths both assert:

- `gltfMaterial.unsupportedTextureTransform` appears in asset-mapping
  diagnostics.
- `render.standardMaterialTexture.unsupportedTextureTransform` appears in app
  diagnostics.
- `render.standardMaterialTexture.missingTexCoord1` does not appear.
- No draw calls are submitted.
- No pipeline or mesh-layout keys are created.
- `diagnosticsSummary` is absent, which confirms the path stops before material
  queue/resource-set diagnostics.

The missing UV1 path asserts the opposite distinction:

- No glTF unsupported-transform diagnostic appears.
- `render.standardMaterialTexture.missingTexCoord1` appears after extraction
  checks mesh layout availability.
- No draw calls or pipeline keys are submitted.

## Boundary Assessment

The current readiness/extraction ordering is intentional:

- Material readiness owns unsupported texture-transform diagnostics.
- Extraction owns mesh-layout-dependent `TEXCOORD_1` availability diagnostics.
- Because transformed UV1 is rejected during readiness, it does not rely on the
  mesh-layout missing-UV path to fail.
- Because untransformed UV1 is readiness-valid, the missing-UV1 fixture reaches
  extraction and reports the mesh-layout diagnostic.

This preserves the ECS/render boundary: material assets describe texture
bindings and transforms; extraction joins those bindings with mesh layout data;
the WebGPU renderer only receives ready draw data.

## Remaining Risks

- The unsupported transform diagnostic name is shared by transformed UV1 and
  transformed non-base-color slots. That is acceptable for now because the
  diagnostic payload carries `field` and `texCoord`, but future UI-facing
  diagnostics may want more specific copy.
- Non-base-color transform support is still intentionally absent. Each slot
  should remain diagnosed until shader sampling, uniform packing, and browser
  coverage are added for that slot.
- Binary GLB loading remains deferred; these fixtures are GLB-shaped source
  asset registration paths.

## Outcome

No corrective implementation change was needed. The browser tests already prove
that supported rotation renders, transformed UV1 and transformed
metallic-roughness stop before queueing, and missing UV1 reports a distinct
mesh-layout diagnostic.
