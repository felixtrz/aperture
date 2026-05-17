# Minimal GLB Material Mapping Plan - 2026-05-17

## Scope

Plan the smallest renderer-independent material mapper that can turn glTF 2.0
material JSON into Aperture source material assets without creating GPU
resources, renderer scene nodes, or ECS entities.

This plan builds on:

- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/STANDARD_MATERIAL_PBR_TEXTURE_EXPECTATIONS_AUDIT_2026_05_17.md`
- `packages/render/src/materials/gltf-sampler.ts`
- three.js `GLTFLoader` material and `KHR_materials_unlit` mapping
- PlayCanvas `glb-parser` material mapping and texture-transform extraction
- Bevy glTF material loading, texture channel handling, and default sampler
  behavior

## Reference Pattern

The common reference pattern is:

- Material JSON is mapped into renderer-independent material source data first.
- `KHR_materials_unlit` switches the target material family and only consumes
  base-color factor/texture plus shared alpha/double-sided render state.
- Core metallic-roughness materials map base color, metallic, roughness,
  metallic-roughness texture, normal texture/scale, occlusion
  texture/strength, emissive factor, and emissive texture.
- Texture info objects carry `index`, optional `texCoord`, and optional
  `KHR_texture_transform` metadata. References either apply that transform in
  material state or warn when a target cannot support it.
- Sampler and texture/image assets are resolved before render submission, but
  GPU textures, samplers, bind groups, and pipelines stay in the renderer.
- Unsupported required extensions must be explicit errors. Unsupported optional
  extensions may be warnings when the base material can still be mapped
  honestly.

## Aperture Contract

Add a helper in `packages/render/src/materials`:

```ts
createMaterialAssetFromGltfMaterial(input): GltfMaterialMappingReport
```

The helper should accept plain glTF-like JSON data and caller-provided resolver
functions. It should not import files, decode images, mutate an asset registry,
spawn ECS entities, or touch WebGPU.

Minimal inputs:

- `material`: unknown or typed glTF material JSON object.
- `materialIndex` or `materialKey`: diagnostic context.
- `extensionsUsed` and `extensionsRequired`: root extension context.
- `resolveTextureBinding(textureInfo, slot)`: returns an Aperture
  `MaterialTextureBinding` or a structured diagnostic. This resolver owns
  texture index to `TextureHandle` and sampler index to `SamplerHandle`
  conversion.
- Optional label override.

Minimal output:

- `valid`: false when required unsupported extensions, malformed core fields, or
  unresolved required handles prevent honest mapping.
- `material`: `UnlitMaterialAsset`, `StandardMaterialAsset`, or `null`.
- `diagnostics`: JSON-safe diagnostics with code, severity, material key, field,
  optional extension name, optional texture index, and optional slot name.

## Mapping Rules

Shared rules:

- `material.name` becomes the asset label when it is a non-empty string.
- `alphaMode` maps to render state:
  - missing or `OPAQUE`: `alphaMode: "opaque"`, no blend, depth write enabled.
  - `MASK`: `alphaMode: "mask"`, `alphaCutoff` default `0.5`.
  - `BLEND`: `alphaMode: "blend"`, alpha blend preset, depth write disabled.
- `doubleSided: true` maps to `cullMode: "none"`; otherwise use back-face
  culling.
- Unknown or malformed scalar/vector fields produce diagnostics instead of
  silent coercion.
- Texture `texCoord` defaults to `0`. Values above the current supported range
  should be preserved on the binding when possible and diagnosed by readiness
  before extraction queues a draw.
- `KHR_texture_transform` should be preserved as
  `MaterialTextureBinding.transform`. Non-identity transforms are currently
  unsupported by shaders, so the mapper should emit a diagnostic and
  StandardMaterial readiness will also block the draw before WebGPU preparation.

`KHR_materials_unlit` rules:

- If `material.extensions.KHR_materials_unlit` exists, return an
  `UnlitMaterialAsset`.
- Map `pbrMetallicRoughness.baseColorFactor` to `baseColorFactor`, defaulting to
  `[1, 1, 1, 1]`.
- Map `pbrMetallicRoughness.baseColorTexture` to `baseColorTexture` through the
  resolver.
- Ignore metallic, roughness, normal, occlusion, and emissive fields for render
  behavior, but report present unsupported fields as optional diagnostics so the
  importer does not imply they are rendered.

`StandardMaterial` rules:

- If `KHR_materials_unlit` is absent, return a `StandardMaterialAsset`.
- `pbrMetallicRoughness.baseColorFactor` defaults to `[1, 1, 1, 1]`.
- `pbrMetallicRoughness.metallicFactor` defaults to `1`.
- `pbrMetallicRoughness.roughnessFactor` defaults to `1`.
- `pbrMetallicRoughness.baseColorTexture` maps to `baseColorTexture`.
- `pbrMetallicRoughness.metallicRoughnessTexture` maps to
  `metallicRoughnessTexture`; shaders read roughness from G and metallic from B.
- `normalTexture` maps to `normalTexture`; `normalTexture.scale` defaults to
  `1` and maps to `normalScale`.
- `occlusionTexture` maps to `occlusionTexture`; `strength` defaults to `1` and
  maps to `occlusionStrength`.
- `emissiveFactor` defaults to `[0, 0, 0]`.
- `emissiveTexture` maps to `emissiveTexture`.

The mapper should not validate texture color space or mesh tangents itself.
Those remain responsibility of texture asset metadata and StandardMaterial
readiness/extraction diagnostics.

## Diagnostics

Initial diagnostic codes should cover:

- unsupported required extension
- unsupported optional material extension
- malformed material object
- malformed factor/vector/scalar field
- malformed texture info
- unresolved texture binding
- unsupported unlit field
- unsupported texture transform

Diagnostics must be JSON-safe and should not include raw cyclic objects,
functions, symbols, binary payloads, or GPU handles.

## Follow-Up Slices

1. Add the renderer-independent GLB material mapping skeleton with tests for
   default StandardMaterial, textured StandardMaterial, and
   `KHR_materials_unlit`.
2. Add focused tests for alpha mode and double-sided render-state mapping.
3. Add focused tests for unsupported required extensions and optional extension
   diagnostics.
4. Audit the mapper against package boundaries before connecting it to broader
   GLB asset loading.

## Non-Goals

- No WebGPU resource creation.
- No image decoding or texture upload.
- No asset-registry mutation inside the mapper.
- No ECS entity or scene hierarchy creation.
- No IBL, shadows, physical material extensions, Draco, Meshopt, KTX2/Basis,
  WebP, AVIF, animation, skins, or morph target mapping.
