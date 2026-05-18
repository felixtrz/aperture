# StandardMaterial Texture-Transform Rotation Support Audit

Date: 2026-05-18

## Scope

Audit the implemented StandardMaterial texture-transform rotation support after
`task-1161`.

This audit checks the boundary across glTF mapping, material texture readiness,
uniform packing, WGSL sampling, extraction diagnostics, and browser fixtures.

## References Inspected

- `docs/research/STANDARD_MATERIAL_TEXTURE_TRANSFORM_ROTATION_FIXTURE_PLAN_2026_05_18.md`
- `docs/research/STANDARD_MATERIAL_TEXTURE_TRANSFORM_SUPPORT_AUDIT_2026_05_18.md`
- `packages/render/src/materials/gltf-material.ts`
- `packages/render/src/materials/standard-texture-readiness.ts`
- `packages/webgpu/src/webgpu/standard-material-buffer.ts`
- `packages/webgpu/src/webgpu/standard-shader.ts`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`

## Findings

The supported surface is still intentionally narrow:

- `baseColorTexture` on `TEXCOORD_0` accepts finite offset, scale, and rotation.
- `baseColorTexture` on `TEXCOORD_1` with a non-identity transform remains
  unsupported.
- Transformed non-base-color slots remain unsupported.
- Identity transforms remain harmless and do not create diagnostics.

The data path is aligned:

- `gltf-material.ts` preserves `KHR_texture_transform` offset, scale, and
  finite rotation.
- `standard-texture-readiness.ts` accepts only base-color UV0 transforms and
  still emits `standardMaterialTexture.unsupportedTextureTransform` for
  transformed UV1.
- `packStandardMaterial()` writes offset, scale, and
  `baseColorTextureRotation` into the documented StandardMaterial uniform.
- `standard-shader.ts` samples base-color textures through a helper that applies
  scale, rotation, then offset.
- Extraction converts unsupported transform readiness diagnostics into
  `render.standardMaterialTexture.unsupportedTextureTransform` before draw
  submission.

Browser coverage now includes:

- `base-color-transform-sampling`: base-color UV0 offset/scale sampling.
- `base-color-transform-rotation-sampling`: base-color UV0 rotation sampling.
- `base-color-transform`: transformed UV1 unsupported compatibility path.
- `base-color-uv1-transform`: transformed UV1 unsupported path where the mesh
  does provide `TEXCOORD_1`, proving the failure is transform support rather
  than missing mesh layout.

## Coordinate Note

The rotation browser fixture uses a deterministic constant-UV mesh and a 4x4
nearest texture with distinct rotated, offset-only, and untransformed texels.
The expected texel choices are fixture-specific because browser texture
sampling, UV origin, and the existing plane/readback setup determine which image
row is observed. The test still proves the important contract: non-zero
rotation changes the sampled texel relative to offset/scale-only sampling and
does so through the WebGPU app path.

## Remaining Gaps

- There is no transformed non-base-color browser fixture yet; `task-1169`
  covers that negative path.
- Rotation support is only implemented for the base-color texture slot. Normal,
  metallic-roughness, occlusion, and emissive texture transforms should remain
  diagnosed until each slot has shader support and browser coverage.
- Binary GLB loading remains deferred; these are GLB-shaped browser fixtures
  using local source asset registration.

## Outcome

No corrective code change was needed. The current implementation preserves the
ECS/render boundary: transform authoring remains material asset data, extraction
owns readiness diagnostics, and the WebGPU renderer owns uniform packing and
shader sampling.
