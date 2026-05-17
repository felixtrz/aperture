# Minimal GLB Texture And Image Mapping Plan - 2026-05-17

## Scope

Plan the smallest renderer-independent GLB texture/image mapper that can feed
the current material mapper with `TextureAsset` and `SamplerAsset` source data.

This should stay below asset loading orchestration. It should not decode image
formats, mutate an asset registry, spawn ECS entities, create render snapshots,
or create WebGPU textures/samplers.

Reference anchors inspected:

- `docs/research/GLB_CONTAINER_SLICE_PLAN_2026_05_16.md`
- `docs/research/MINIMAL_GLB_MATERIAL_MAPPING_PLAN_2026_05_17.md`
- `docs/research/ASSET_LOADER_SCENE_IMPORT_COVERAGE.md`
- three.js `GLTFLoader` texture, image, bufferView, and sampler loading
- PlayCanvas `glb-parser` image/texture creation and sampler application
- Bevy glTF image loading and `ImageSamplerDescriptor` mapping

## Reference Pattern

The common pattern is:

- glTF `textures[n]` references `images[source]` and optional
  `samplers[sampler]`.
- glTF `images[n]` references either a URI or a bufferView plus MIME type.
- Texture sampler state is mapped before render submission, but GPU sampler
  creation remains backend-owned.
- Encoded image bytes are decoded by an image loader path, not by material
  mapping.
- Texture color-space and semantic are determined by material slot usage:
  base-color and emissive are color/sRGB, while metallic-roughness, normal,
  and occlusion are linear/data inputs.
- Unsupported compressed or alternative texture extensions are explicit
  diagnostics, especially when required.

## Aperture Contract

Add a helper in `packages/render/src/materials` or `packages/render/src/assets`
after this plan:

```ts
createTextureAssetFromGltfTexture(input): GltfTextureMappingReport
```

The helper should accept plain glTF-like `textures`, `images`, and `samplers`
arrays plus caller-provided resolver inputs. It should return source assets and
diagnostics only.

Minimal inputs:

- `textureIndex`: glTF texture index requested by material mapping.
- `slot`: material usage slot such as `baseColorTexture`,
  `metallicRoughnessTexture`, `normalTexture`, `occlusionTexture`, or
  `emissiveTexture`.
- `textures`, `images`, and `samplers`: root glTF arrays as plain JSON.
- `resolveImageData(imageRef)`: caller hook that turns image URI or bufferView
  metadata into decoded pixel data compatible with `TextureAsset.sourceData`.
- Optional label prefix or handle key context.
- Optional `extensionsRequired` context for texture/image extension diagnostics.

`resolveImageData` owns:

- URI fetching or rejecting external URI usage.
- Data URI decoding.
- GLB bufferView byte lookup.
- PNG/JPEG decoding into width, height, pixel format, row stride, and raw pixel
  bytes.

The mapping helper owns:

- Validating texture, image, sampler, and texture-extension metadata.
- Calling `createSamplerAssetFromGltfSampler`.
- Choosing `TextureAsset.semantic` and `TextureAsset.colorSpace` from the
  material slot.
- Producing JSON-safe diagnostics.
- Returning source `TextureAsset` and `SamplerAsset` values plus enough mapping
  metadata for the caller to register handles.

## Slot Mapping

Initial semantic/color-space rules:

- `baseColorTexture`: semantic `base-color`, color space `srgb`, format
  `rgba8unorm-srgb` when the decoded image is 8-bit RGBA-compatible.
- `emissiveTexture`: semantic `emissive`, color space `srgb`, format
  `rgba8unorm-srgb`.
- `metallicRoughnessTexture`: semantic `metallic-roughness`, color space
  `data`, format `rgba8unorm`.
- `normalTexture`: semantic `normal`, color space `data`, format `rgba8unorm`.
- `occlusionTexture`: semantic `occlusion`, color space `data`, format
  `rgba8unorm`.

If the same glTF texture index is used by multiple slots with different
semantic/color-space requirements, the caller should register distinct
Aperture `TextureAsset` values keyed by texture index plus slot/semantic. The
mapper should not silently reuse an sRGB texture asset for data/normal sampling.

## Image Inputs

Supported initial image sources:

- GLB bufferView image data with MIME type `image/png` or `image/jpeg`, when the
  caller resolver can decode it.
- Data URI `image/png` or `image/jpeg`, when the caller resolver allows data
  URI decoding.
- External URI image references may be passed through a resolver but should be
  explicitly allowed by the caller. The helper should not fetch by itself.

Unsupported initial image sources should produce diagnostics:

- Missing `image.uri` and missing `image.bufferView`.
- Missing MIME type for bufferView images.
- Unsupported MIME types.
- `KHR_texture_basisu`, `EXT_texture_webp`, `EXT_texture_avif`, KTX/KTX2/Basis,
  or other compressed/alternative image extensions.
- Invalid texture `source` or `sampler` indices.
- Resolver failures for decode, dimensions, unsupported pixel format, or
  missing image bytes.

## Output Shape

Minimal report:

```ts
interface GltfTextureMappingReport {
  valid: boolean;
  texture: TextureAsset | null;
  sampler: SamplerAsset | null;
  textureIndex: number;
  imageIndex?: number;
  samplerIndex?: number;
  slot: GltfMaterialTextureSlot;
  diagnostics: GltfTextureMappingDiagnostic[];
}
```

The report should be JSON-safe. The JSON value should summarize byte lengths
instead of embedding raw `Uint8Array` payloads.

## Diagnostics

Initial diagnostic codes should cover:

- malformed texture object
- invalid texture source index
- invalid sampler index
- malformed image object
- missing image source
- unsupported image MIME type
- unsupported texture extension
- unsupported required texture extension
- image resolver failure
- sampler mapping failure
- incompatible decoded image format

Diagnostics should include texture index, image index, sampler index, slot,
field, extension name, severity, and a small JSON-safe value when useful.

## Non-Goals

- No image decoding inside the mapper.
- No network or file fetching inside the mapper.
- No WebGPU texture/sampler creation.
- No asset registry mutation.
- No ECS authoring.
- No KTX2/Basis/WebP/AVIF support in the first slice.
- No mipmap generation or GPU upload policy.

## Follow-Up Slices

1. Implement the minimal texture/image mapping helper with tests for decoded
   bufferView image data, data URI/external URI resolver failures, sampler
   integration, and invalid texture/source metadata.
2. Connect the GLB material mapper resolver to texture/sampler mapping reports
   in a narrow test-only fixture before broader GLB asset loading.
3. Audit the combined GLB material/texture helpers for package-boundary drift
   before adding scene or asset-registry orchestration.
