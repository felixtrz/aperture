# Material, Texture, Sampler, And Render-State Coverage

This note records the reference-engine coverage for `task-0019` and turns it into an Aperture MVP schema direction. It is a planning artifact only; it does not introduce runtime source changes.

## Scope

The goal is not to copy every material option from three.js, Babylon.js, or PlayCanvas. The goal is to define a small, data-driven material surface that:

- Keeps ECS render components limited to handles and simple per-entity state.
- Lets rendering derive pipeline state, bind groups, and diagnostics from asset/resource data.
- Maps cleanly onto WebGPU pipeline descriptors.
- Leaves room for custom WGSL materials and richer PBR without changing the ECS boundary.

## Reference Engine Source Anchors

### three.js

Representative files inspected:

- `src/materials/Material.js`
- `src/materials/MeshBasicMaterial.js`
- `src/materials/MeshStandardMaterial.js`
- `src/materials/MeshPhysicalMaterial.js`
- `src/materials/MeshNormalMaterial.js`
- `src/materials/ShaderMaterial.js`
- `src/materials/LineBasicMaterial.js`
- `src/materials/PointsMaterial.js`
- `src/textures/Texture.js`
- `src/textures/DataTexture.js`
- `src/textures/CompressedTexture.js`
- `src/textures/CubeTexture.js`
- `src/textures/VideoTexture.js`
- `src/constants.js`
- `src/renderers/webgpu/utils/WebGPUPipelineUtils.js`
- `src/renderers/common/RenderObject.js`
- `src/renderers/common/Pipelines.js`
- `src/renderers/common/Sampler.js`
- `src/renderers/common/Textures.js`

Findings:

- `Material` owns common render-state inputs: side/culling, opacity, transparency, alpha hash/test, blending, blend factors, depth function/test/write, stencil state, color write, polygon offset, visibility, tone mapping, user data, and versioning.
- `MeshBasicMaterial` is an unlit family with base color, base map, light/ao/specular/alpha/env maps, wireframe state, and fog participation.
- `MeshStandardMaterial` is the practical PBR baseline: base color, roughness, metalness, emissive, normal, displacement, alpha, occlusion/light, roughness, and metalness maps.
- `MeshPhysicalMaterial` extends the standard model with clearcoat, sheen, transmission, thickness, attenuation, iridescence, anisotropy, IOR, and specular intensity. These are later features for Aperture.
- `ShaderMaterial` exposes custom defines, uniforms, shader sources, uniform groups, lights/clipping flags, and GLSL version. Aperture should not model this GLSL-first API in MVP; the later custom path should be explicit WGSL.
- `Texture` carries image/source identity, wrapping, filters, anisotropy, format/type, UV transform, mipmap generation, premultiply/flip/unpack flags, and color space. The core constants define color spaces, texture formats, wrapping/filtering modes, depth/stencil functions, blend factors, and stencil operations.
- WebGPU pipeline utility code maps material state into GPU blend, primitive, depth/stencil, and diagnostics. This confirms that Aperture's material schema should separate authoring fields from normalized pipeline-key fields.

### Babylon.js

Representative files inspected:

- `packages/dev/core/src/Materials/material.ts`
- `packages/dev/core/src/Materials/standardMaterial.ts`
- `packages/dev/core/src/Materials/PBR/pbrMaterial.ts`
- `packages/dev/core/src/Materials/PBR/pbrBaseMaterial.ts`
- `packages/dev/core/src/Materials/PBR/pbrBaseSimpleMaterial.ts`
- `packages/dev/core/src/Materials/PBR/pbrMetallicRoughnessMaterial.ts`
- `packages/dev/core/src/Materials/shaderMaterial.ts`
- `packages/dev/core/src/Materials/Textures/baseTexture.ts`
- `packages/dev/core/src/Materials/Textures/texture.ts`
- `packages/dev/core/src/Materials/Textures/textureSampler.ts`
- `packages/dev/core/src/Materials/Textures/internalTexture.ts`
- `packages/dev/core/src/Materials/Textures/rawTexture.ts`
- `packages/dev/core/src/Materials/Textures/cubeTexture.ts`
- `packages/dev/core/src/Materials/Textures/videoTexture.ts`
- `packages/dev/core/src/Materials/Textures/renderTargetTexture.ts`
- `packages/dev/core/src/States/depthCullingState.ts`
- `packages/dev/core/src/States/stencilState.ts`
- `packages/dev/core/src/States/alphaCullingState.ts`
- `packages/dev/core/src/Engines/WebGPU/webgpuCacheSampler.ts`
- `packages/dev/core/src/Engines/WebGPU/webgpuCacheRenderPipeline.ts`
- `packages/dev/core/src/Engines/WebGPU/webgpuMaterialContext.ts`
- `packages/dev/core/src/Engines/WebGPU/webgpuTextureHelper.ts`
- `packages/dev/core/src/Engines/WebGPU/webgpuShaderProcessorsWGSL.ts`

Findings:

- Base `Material` separates alpha, culling, side orientation, alpha modes, transparency modes, depth pre-pass/depth write/depth function, stencil, fill mode, readiness, and bind/unbind behavior.
- `StandardMaterial` exposes diffuse, opacity, reflection, emissive, bump/normal, lightmap, refraction, specular, roughness, alpha-from-diffuse, and lighting toggles.
- `PBRMetallicRoughnessMaterial` is the closest MVP target because it mirrors glTF concepts: base color, base texture, metallic factor, roughness factor, and packed metallic-roughness texture channels.
- PBR base material adds environment intensity, emissive intensity, normal/bump, AO, alpha cutoff, premultiply choices, texture channel flags, and readiness checks.
- `ShaderMaterial` supports custom shader paths/options, uniforms, samplers, uniform buffers, storage buffers, texture samplers, shader language selection, and custom shader resolution.
- Texture classes separate texture source/lifetime from sampler state. `TextureSampler` includes U/V/W wrapping, anisotropy, sampling mode, comparison function, and equality; WebGPU sampler cache code reinforces that sampler descriptors need stable keys.

### PlayCanvas

Representative files inspected:

- `src/scene/materials/material.js`
- `src/scene/materials/standard-material.js`
- `src/scene/materials/standard-material-parameters.js`
- `src/scene/materials/standard-material-validator.js`
- `src/scene/materials/lit-material.js`
- `src/scene/materials/lit-material-options.js`
- `src/scene/materials/shader-material.js`
- `src/platform/graphics/texture.js`
- `src/platform/graphics/blend-state.js`
- `src/platform/graphics/depth-state.js`
- `src/platform/graphics/stencil-parameters.js`
- `src/platform/graphics/constants.js`
- `src/platform/graphics/webgpu/webgpu-shader-processor-wgsl.js`
- `src/platform/graphics/webgpu/webgpu-texture.js`

Findings:

- Base `Material` owns alpha test, alpha-to-coverage, blend/depth state, culling, stencil front/back, color write masks, shader chunks, shader defines, and material parameters.
- `BlendState`, `DepthState`, and `StencilParameters` are explicit descriptors with stable equality/key behavior. This is a useful model for Aperture pipeline-key inputs.
- `StandardMaterial` contains a broad material matrix: diffuse/emissive/specular/metalness/gloss, opacity, normal, AO, lightmap, detail maps, clearcoat, vertex color controls, UV transform/channel controls, and validation metadata.
- `LitMaterial` splits custom material front-end shader chunks from lighting back-end options, with GLSL and WGSL chunk slots. This is useful later, but too flexible for Aperture MVP.
- `ShaderMaterial` accepts shader descriptions with unique names and explicit GLSL/WGSL source fields.
- `Texture` describes format, dimensions, mipmaps, cube/array/volume shape, min/mag filters, anisotropy, U/V addressing, compare-on-read, compare function, source data, texture views, and sRGB/linear format conversion.

## Aperture MVP Schema Direction

### Handles

Use opaque typed handles in ECS-facing components:

```ts
type MaterialHandle = ResourceHandle<"material">;
type TextureHandle = ResourceHandle<"texture">;
type SamplerHandle = ResourceHandle<"sampler">;
```

The ECS `Material` component should keep material references as handles. A
future `MaterialSlots` component may bind submesh slots to material handles. ECS
components must not embed material data, GPU resources, shader instances, or
render-state objects.

### Material Assets

MVP material assets should be serializable plain data:

```ts
type MaterialAsset =
  | UnlitMaterialAsset
  | MetallicRoughnessMaterialAsset
  | DebugNormalMaterialAsset;

interface BaseMaterialAsset {
  name?: string;
  alphaMode?: "opaque" | "mask" | "blend";
  alphaCutoff?: number;
  cullMode?: "back" | "front" | "none";
  frontFace?: "ccw" | "cw";
  depth?: DepthStateDescriptor;
  blend?: BlendStateDescriptor;
  colorWriteMask?: ColorWriteMask;
}
```

Recommended MVP material kinds:

- `UnlitMaterialAsset`: base color factor, optional base color texture, alpha mode/cutoff, and render state.
- `MetallicRoughnessMaterialAsset`: glTF-style base color, base color texture, metallic factor, roughness factor, packed metallic-roughness texture, normal texture/scale, occlusion texture/strength, emissive factor/texture, alpha mode/cutoff, and render state.
- `DebugNormalMaterialAsset`: a diagnostic shader family for normal visualization. It should not require lights or a full PBR path.

Do not expose `PhysicalMaterial`, arbitrary node graphs, shader chunks, or plugin systems in the MVP schema.

### Texture Assets

Texture assets describe source-independent texture identity and upload requirements:

```ts
interface TextureAsset {
  name?: string;
  dimension: "2d" | "cube";
  size?: { width: number; height: number; depthOrLayers?: number };
  format: TextureFormat;
  colorSpace: "srgb" | "linear" | "data";
  mipLevelCount?: number;
  usage?: TextureUsage[];
  source?: TextureSourceDescriptor;
}
```

MVP texture support:

- 2D textures for base color, metallic-roughness, normal, occlusion, and emissive maps.
- Optional cube texture handle shape in the schema, even if environment lighting waits.
- Explicit `colorSpace` so color textures can be `srgb` and data maps can be `linear` or `data`.
- Texture source data stays in the asset/resource layer; ECS stores only handles.

Defer compressed textures, video/canvas textures, render targets as sampleable texture assets, texture arrays, 3D volume textures, procedural textures, and texture views until the renderer has the MVP path working.

### Sampler Assets

Sampler descriptors should be separate resources so identical samplers can share WebGPU objects:

```ts
interface SamplerAsset {
  label?: string;
  addressModeU: "clamp-to-edge" | "repeat" | "mirror-repeat";
  addressModeV: "clamp-to-edge" | "repeat" | "mirror-repeat";
  addressModeW?: "clamp-to-edge" | "repeat" | "mirror-repeat";
  magFilter: "nearest" | "linear";
  minFilter: "nearest" | "linear";
  mipmapFilter?: "nearest" | "linear";
  lodMinClamp?: number;
  lodMaxClamp?: number;
  maxAnisotropy?: number;
}
```

MVP should support clamp/repeat/mirror address modes and nearest/linear filtering. Anisotropy can be represented but ignored or rejected until supported. Comparison samplers should be deferred to shadows/depth-texture work.

### Render State

Normalize render-state authoring fields into a small WebGPU-facing subset:

```ts
interface DepthStateDescriptor {
  test: boolean;
  write: boolean;
  compare:
    | "never"
    | "less"
    | "equal"
    | "less-equal"
    | "greater"
    | "not-equal"
    | "greater-equal"
    | "always";
  bias?: number;
  biasSlopeScale?: number;
}

interface BlendStateDescriptor {
  preset: "none" | "alpha" | "premultiplied-alpha" | "additive";
}
```

MVP defaults:

- `alphaMode: "opaque"` unless specified.
- `alphaCutoff: 0.5` for mask materials.
- `cullMode: "back"` and `frontFace: "ccw"`.
- Depth test enabled, depth write enabled for opaque/mask, depth write disabled for alpha blend.
- Blend preset is derived from alpha mode unless explicitly supplied.
- Stencil is unsupported in MVP and should produce a validation diagnostic if requested.
- Color-write masks may be represented for future passes but can default to all channels enabled.

## Pipeline Key Inputs

Material resolution should produce deterministic pipeline-key inputs. A first key should include:

- Shader family: unlit, metallic-roughness, debug-normal, later custom WGSL.
- Material feature bits: base texture, metallic-roughness texture, normal texture, occlusion texture, emissive texture, vertex color, alpha mode.
- Mesh vertex layout and topology from the render packet.
- Instancing, skinning, and morph flags from extraction.
- Cull mode and front face.
- Depth compare/write/test state.
- Blend preset and color write mask.
- Render target color format, depth/stencil format, and sample count from the active view/pass.
- WGSL module or shader variant identity for later custom materials.

Material values that are only uniform data, such as base color factor or roughness factor, should not create new pipelines unless they change shader feature bits.

## Validation And Diagnostics

Material validation should emit structured diagnostics that include material handle/id, field path, severity, and a concise message. MVP diagnostics should cover:

- Missing texture or sampler handle.
- Texture dimension not supported by the material slot.
- Unsupported texture format or compression.
- Color-space mismatch, such as using `srgb` for normal or metallic-roughness maps.
- Non-filterable texture format used with linear filtering.
- `alphaMode: "mask"` with invalid `alphaCutoff`.
- Blend material requesting depth write without an explicit override.
- Normal texture used with a mesh that has no normals or no tangent fallback plan.
- Material slot referenced by `MaterialSlots` but not present on the mesh submesh
  list.
- Stencil state requested before stencil support exists.
- Custom shader language/source requested before the custom WGSL material path exists.
- Too many sampled textures for the current bind group layout.
- Pipeline-key feature combination not supported by the current WebGPU renderer.

Diagnostics should be data emitted during asset validation or render extraction, not console-only side effects.

## Deferred Features

Keep these outside the MVP:

- Physical material extensions: clearcoat, sheen, transmission, thickness, attenuation, iridescence, anisotropy, IOR, and specular intensity.
- Node materials, shader chunks, material plugins, and arbitrary GLSL translation.
- Full custom shader material API. Later custom materials should be explicit WGSL with declared bindings.
- Advanced transparency, order-independent transparency, alpha hash, alpha-to-coverage, and depth pre-pass policies.
- Displacement/parallax mapping and tessellation-style features.
- Environment IBL, reflection probes, BRDF LUTs, and skybox material integration beyond reserving handles.
- Video textures, canvas textures, data textures as public authoring APIs, render-target textures, arrays, 3D textures, and texture views.
- Compressed texture containers and transcoding, unless introduced by a dedicated asset-loader task.
- Stencil-heavy workflows, decals, multi-pass materials, and per-pass material overrides.
- Line, point, sprite, depth-only, shadow, and distance material families.

## Future Implementation Tests

When implementation begins, add tests around these behaviors:

1. Creating an unlit material produces a serializable `MaterialAsset` with default opaque render state.
2. A metallic-roughness material stores base color, metallic, roughness, emissive, normal, and occlusion fields without requiring GPU access.
3. Alpha mask materials default `alphaCutoff` to `0.5` and reject out-of-range cutoff values.
4. Alpha blend materials normalize to depth write disabled and alpha blend pipeline state.
5. Sampler descriptors with identical fields produce the same stable key.
6. Texture descriptors reject `srgb` color space for normal and metallic-roughness slots.
7. Pipeline keys change when texture feature bits change but do not change when only uniform factors change.
8. A missing material handle during render extraction emits a structured diagnostic and skips the affected draw packet.
9. A submesh material slot without a matching material binding emits a diagnostic with entity and submesh identifiers.
10. Requesting stencil state before stencil support emits an unsupported-feature diagnostic.
11. A material using a normal texture on a mesh without normals emits a validation diagnostic.
12. Custom GLSL shader material data is rejected by MVP validation with a message pointing to future WGSL-only support.
