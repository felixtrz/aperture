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
