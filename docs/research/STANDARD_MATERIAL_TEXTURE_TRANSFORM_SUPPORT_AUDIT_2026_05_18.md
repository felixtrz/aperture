# StandardMaterial Texture-Transform Support Audit

Date: 2026-05-18

## Scope

Audit the StandardMaterial texture-transform contract after adding sampled
base-color offset/scale support. This audit checks that mapping, readiness,
uniform packing, WGSL sampling, and browser status agree on the supported
surface:

- supported: `baseColorTexture` offset/scale on `TEXCOORD_0`
- unsupported: rotation
- unsupported: transformed non-UV0 bindings
- unsupported: transformed non-base-color slots

No production code change was needed in this audit.

## References Inspected

- `docs/research/GLB_TEXTURE_TRANSFORM_SAMPLING_FIXTURE_PLAN_2026_05_18.md`
- `docs/research/STANDARD_GLB_NON_UV0_TEXTURE_COORDINATE_FIXTURE_PLAN_2026_05_18.md`
- `packages/render/src/materials/gltf-material.ts`
- `packages/render/src/materials/standard-texture-readiness.ts`
- `packages/webgpu/src/webgpu/standard-material-buffer.ts`
- `packages/webgpu/src/webgpu/standard-shader.ts`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`
- `test/materials/gltf-material.test.ts`
- `test/materials/standard-texture-readiness.test.ts`
- `test/webgpu/standard-material-buffer.test.ts`
- `test/webgpu/standard-shader.test.ts`

## Findings

### Mapping boundary is honest

`gltf-material.ts` preserves `KHR_texture_transform` data on material texture
bindings. Its support predicate only accepts `baseColorTexture` on texcoord `0`
with `rotation === 0`.

That matches the current implementation. Rotation, transformed UV1, and
transformed non-base-color slots still emit
`gltfMaterial.unsupportedTextureTransform` warnings. The warning text is narrow:
only base-color offset/scale transforms on `TEXCOORD_0` are rendered by current
material shaders.

### Readiness boundary blocks unsupported transforms

`standard-texture-readiness.ts` uses the same supported surface:
`baseColorTexture`, texcoord `0`, and no rotation. Unsupported transform
diagnostics are warnings, but the readiness report treats any diagnostic as
not ready. This prevents the app route from submitting draws for rotation or
transformed non-UV0 paths.

The readiness tests cover:

- rotation on base-color UV0 as unsupported
- offset/scale on base-color UV0 as accepted
- offset/scale on base-color UV1 as unsupported

### Uniform packing and WGSL agree

`standard-material-buffer.ts` packs only base-color offset and scale into the
StandardMaterial uniform:

- offset defaults to `[0, 0]`
- scale defaults to `[1, 1]`
- rotation is intentionally not packed

`standard-shader.ts` defines `standardTextureTransformUv()` only when the
base-color texture feature is present and applies it only to the chosen
base-color UV stream before sampling. Other texture slots continue to use the
selected UV stream directly.

This is consistent with the readiness gate: unsupported transformed bindings
should not reach draw submission through the app path.

### Browser status covers success and failure paths

`standard-gltf-texture?scenario=base-color-transform-sampling` proves the
supported path by sampling a GLB-shaped base-color offset/scale transform and
checking the transformed texel through screenshot/readback assertions.

`standard-gltf-texture?scenario=base-color-transform` remains the unsupported
rotation fixture. It expects both mapping and render-readiness diagnostics and
asserts that no pipelines or draws are submitted.

`standard-gltf-texture?scenario=base-color-uv1` proves untransformed UV1
sampling remains valid. It does not expand transform support to UV1.

## Gaps

- There is no browser fixture for a transformed UV1 binding whose mesh has
  `TEXCOORD_1`; readiness tests cover it, but the browser fixture matrix does
  not yet prove the no-draw path in app status.
- Rotation support remains unimplemented by design. A future rotation fixture
  should use a texture/sample layout that distinguishes rotation from
  offset/scale without ambiguous nearest-neighbor texel selection.
- `packStandardMaterial()` intentionally packs offset/scale without revalidating
  the transform contract. The app path relies on texture-readiness diagnostics
  to block unsupported transformed draws. If packers become a public low-level
  API, they may need a dedicated transform-support diagnostic.

## Follow-Up

`task-1158` now covers the most immediate paired failure-path gap for missing
`TEXCOORD_1`. Keep the existing `task-1156` rotation-fixture planning task
before implementing rotation math.
