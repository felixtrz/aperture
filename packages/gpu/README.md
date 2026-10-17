# @aperture-engine/gpu

Standalone WebGPU effect, draw and compute authoring using Aperture's shared
frame graph and executor. No ECS, UI, native binding or shader compiler is loaded
by the runtime entry point.

Use `createGpuContext({device, output})` with borrowed platform objects, or
`createBrowserGpuContext({canvas})` from `@aperture-engine/gpu/browser`.
Declare resources, prepare operations, call `frame()`, and `dispose()` explicitly.

See the [shader-first tutorial](https://github.com/felixtrz/aperture/blob/main/docs/SHADER_FIRST.md)
for parameters, history, raw interop, transactional replacement and portable capture.
