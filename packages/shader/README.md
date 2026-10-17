# @aperture-engine/shader

Portable WGSL artifacts, reflected resource/host layouts, packing, source-mapped
diagnostics and shader-job codecs. The ordinary entry point is compiler-free.

Use `compileShaderFile()` or `compileShader()` from `/compiler` in Node build tools;
use `prepareShader()` from `/prepare` explicitly for dynamic setup-time source in
browsers or Node. Reflection is pinned to `wgsl_reflect@1.6.0`; actual WebGPU device
compilation validates semantic correctness. Module directives are
`// @import "./library.wgsl"`.

See [shader authoring](https://github.com/felixtrz/aperture/blob/main/docs/SHADER_FIRST.md)
and [ECS materials](https://github.com/felixtrz/aperture/blob/main/docs/SHADER_MATERIALS.md).
