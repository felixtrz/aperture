# Light Shader WGSL Contract

This document records the renderer-side packed-light shader declaration
contract. It is inspection and integration metadata for WebGPU shaders; it does
not make ECS own GPU resources and does not activate new lighting paths by
itself.

## Scope

The contract is defined in `@aperture-engine/webgpu` by:

- `LIGHT_SHADER_BINDING_METADATA`
- `LIGHT_SHADER_WGSL_DECLARATION`
- `createLightShaderWgslDeclarationContract()`
- `lightShaderWgslDeclarationContractToJsonValue()`
- `lightShaderWgslDeclarationContractToJson()`

The WGSL declaration names the packed light buffers:

- group `3`, binding `0`: `lightFloats`, `var<storage, read>`, `array<f32>`
- group `3`, binding `1`: `lightMetadata`, `var<storage, read>`, `array<i32>`

The declaration also records the current packing strides and field order:

- float stride: color rgba, intensity, range, inner cone angle, outer cone angle
- metadata stride: kind, world transform offset, layer mask, light id, entity
  index, entity generation

## Boundary

The JSON helper is a debug/inspection surface. It serializes binding metadata,
strides, and WGSL declaration text only. It intentionally omits raw
`GPUBuffer`, `GPUBindGroupLayout`, `GPUBindGroup`, shader module, and pipeline
handles.

The metadata-only unlit shader variant,
`UNLIT_MESH_WITH_LIGHT_BINDINGS_SHADER`, records the future light bind group
requirements while keeping the normal unlit WGSL source unchanged. It should not
be routed into active rendering until a specific lighting integration task
requires it.

The active StandardMaterial proof path already consumes packed light buffers for
ambient and directional direct lighting. Texture lighting, IBL, skybox
consumption, and shadow maps remain separate renderer-owned work.

## Lit custom materials (`@group(3)` contract v1)

Custom WGSL materials opt into lighting with
`CustomWgslMaterialAsset.lighting: "lit"` (parity plan A1). The contract is
defined renderer-independently in `@aperture-engine/render`
(`materials/lit-contract.ts`):

- `APERTURE_LIT_CONTRACT_VERSION` / `APERTURE_LIT_PIPELINE_FEATURE`
  (`lit:v1`) — the version participates in every lit pipeline key so a future
  layout change cannot collide with cached pipelines. Absent/`"unlit"`
  materials keep byte-identical keys.
- `APERTURE_LIT_BINDING_METADATA` — the binding table below.
- `APERTURE_LIT_WGSL_HEADER` — the WGSL header the renderer PREPENDS to the
  material's module. User code must not declare `@group(3)` (rejected with
  `customMaterialSource.litReservedBindGroup`) or redeclare `aperture*`
  symbols.

The v1 group(3) layout (all bindings fragment-visible; every binding is
always present — absent frame resources bind renderer-owned fallbacks so ONE
explicit pipeline layout works every frame):

| Binding | Name                                | WGSL type            | Frame resource (fallback)                                           |
| ------- | ----------------------------------- | -------------------- | ------------------------------------------------------------------- |
| 0       | `apertureLightFloats`               | `array<f32>`         | packed light floats (16-byte zeroed buffer)                         |
| 1       | `apertureLightMetadata`             | `array<i32>`         | packed light metadata (16-byte zeroed buffer)                       |
| 2       | `apertureLitParams`                 | `ApertureLitParams`  | counts/IBL flags/contract version/fog color+params (always present) |
| 3       | `apertureDirectionalShadowMatrices` | `array<mat4x4f>`     | directional shadow receiver matrices (64-byte zeroed buffer)        |
| 4       | `apertureDirectionalShadowMap`      | `texture_depth_2d`   | directional shadow map (1x1 depth texture)                          |
| 5       | `apertureDirectionalShadowSampler`  | `sampler_comparison` | shadow comparison sampler (less-equal fallback)                     |
| 6       | `apertureIblIrradianceTexture`      | `texture_cube<f32>`  | diffuse IBL irradiance cube (1x1 black cube)                        |
| 7       | `apertureIblSpecularTexture`        | `texture_cube<f32>`  | prefiltered specular (PMREM) cube (1x1 black cube)                  |
| 8       | `apertureIblBrdfLutTexture`         | `texture_2d<f32>`    | split-sum BRDF LUT when integrated (1x1 black 2d)                   |
| 9       | `apertureIblSampler`                | `sampler`            | IBL filtering sampler (linear fallback)                             |

`ApertureLitParams` is `{ lightCount, directionalShadowCount, iblFlags,
contractVersion: u32; fogColor, fogParams: vec4f }`; `lightCount` is
authoritative (never `arrayLength` — fallback buffers are non-empty), and
`iblFlags` carries the irradiance/specular/BRDF-LUT presence bits.

Header helpers (fragment stage, StandardMaterial math parity):
`apertureCountLights()`, `apertureEvaluateLight(index, worldPos, normal,
viewDir)` (white dielectric convenience), `apertureEvaluateLightSurface(...,
baseColor, metallic, roughness)` (exact Lambert+GGX ambient/directional/
point/spot; rect-area is a documented diffuse-only approximation),
`apertureDirectionalShadow(worldPos, normal)` (1.0 without shadow resources;
all filter modes evaluate as 3x3 PCF in v1), `apertureSampleIblIrradiance`,
`apertureSampleIblSpecular`, `apertureEnvironmentBrdf` (analytic split-sum
scale/bias), `apertureApplyFog`, and `apertureLinearToSrgb`.

Realization: the WebGPU backend compiles lit pipelines against an EXPLICIT
pipeline layout (`custom-wgsl-lit-contract.ts` derives it from the binding
table) instead of `layout: "auto"`, so one renderer-owned group(3) bind group
is shared across every lit custom pipeline and cached across frames while the
underlying resource identities are stable (`custom-wgsl-lit-resources.ts`).
The bound resources are the SAME renderer-owned objects the StandardMaterial
path consumes: the packed light buffers, the auto-shadow frame's directional
receiver resources, and the app environment's IBL textures. See
`docs/DECISIONS.md` 0024 for the versioning story and
`docs/AUTHORING.md` ("Lit custom materials") for the authoring surface.
