# GLB Material/Texture Integration Diagnostics - 2026-05-17

## Purpose

Document how the current GLB root, texture, sampler, and material helpers
compose without introducing asset-registry mutation, ECS authoring, image
decoding, or WebGPU resource preparation.

Current helper layers:

1. `validateGltfRootForAssetMapping` checks glTF 2.0 root shape and unsupported
   required extensions.
2. `createTextureAssetFromGltfTexture` maps one glTF texture/image/sampler
   reference into source `TextureAsset` and `SamplerAsset` values using a
   caller-owned decoded-image resolver.
3. `createSamplerAssetFromGltfSampler` maps glTF sampler enums into
   `SamplerAsset` source data.
4. `createMaterialAssetFromGltfMaterial` maps one glTF material object into
   `StandardMaterialAsset` or `UnlitMaterialAsset` using a caller-owned
   texture-binding resolver.

## Successful Flow

The integration shape is intentionally handle-oriented:

```text
glTF texture info index
  -> createTextureAssetFromGltfTexture(...)
  -> caller registers or plans TextureAsset/SamplerAsset handles
  -> material resolveTextureBinding(...) returns those handles
  -> createMaterialAssetFromGltfMaterial(...) stores MaterialTextureBinding
```

The current test fixture stops before registry mutation. It assigns deterministic
test handles from successful texture reports:

```ts
texture: createTextureHandle(`gltf-texture:${textureIndex}:${slot}`);
sampler: createSamplerHandle(`gltf-sampler:${textureIndex}:${slot}`);
```

That proves the material mapper can consume texture-mapping output without
knowing how assets are eventually registered.

## Missing Texture Diagnostic Example

When image bytes cannot be decoded or resolved, the texture report owns the
source failure:

```json
{
  "code": "gltfTexture.imageResolverFailed",
  "severity": "error",
  "textureIndex": 0,
  "imageIndex": 0,
  "slot": "baseColorTexture",
  "message": "Image 0 was not decoded."
}
```

The material resolver translates that into material-context diagnostics:

```json
{
  "code": "gltfMaterial.unresolvedTextureBinding",
  "severity": "error",
  "materialKey": "material:missing-deps",
  "field": "pbrMetallicRoughness.baseColorTexture",
  "slot": "baseColorTexture",
  "dependencyKind": "texture",
  "textureIndex": 0,
  "message": "Image 0 was not decoded."
}
```

## Missing Sampler Diagnostic Example

When a glTF texture references a missing sampler index, the texture report
keeps the sampler index:

```json
{
  "code": "gltfTexture.invalidSamplerIndex",
  "severity": "error",
  "textureIndex": 1,
  "samplerIndex": 4,
  "slot": "metallicRoughnessTexture"
}
```

The material resolver preserves that distinction:

```json
{
  "code": "gltfMaterial.unresolvedTextureBinding",
  "severity": "error",
  "materialKey": "material:missing-deps",
  "field": "pbrMetallicRoughness.metallicRoughnessTexture",
  "slot": "metallicRoughnessTexture",
  "dependencyKind": "sampler",
  "textureIndex": 1,
  "samplerIndex": 4
}
```

## Boundary Rule

These helpers are source-data mappers only. A future GLB asset loader may call
them, register assets, and emit ECS authoring commands, but that orchestration
must remain explicit and testable. The helper layer should continue to avoid:

- image decoding,
- URI fetching,
- `AssetRegistry` mutation,
- ECS entity/component authoring,
- render snapshot creation,
- WebGPU resource creation,
- browser globals or DOM APIs.
