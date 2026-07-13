---
"@aperture-engine/render": minor
"@aperture-engine/webgpu": minor
"@aperture-engine/app": minor
---

Data-described compute kernels (parity plan C3) — the analog of three.js TSL
`wgslFn` / `computeShader`, where a compute dispatch is described as data instead
of hand-built. It reduces the raw-WebGPU surface area of `app.addComputePass`: the
raw `encode(ctx)` path (build a `GPUComputePipeline` + `GPUBindGroup`, record the
dispatch) stays for full control, and a new `app.addComputeKernelPass({ name,
kernel, workgroups })` dispatches a WGSL kernel from a `ComputeKernelAsset` while
the user touches NO `GPUDevice` API — no `createComputePipeline`,
`createBindGroup`, or `createBuffer`.

A `ComputeKernelAsset` (render package, data-only per DECISIONS 0016) is the
compute sibling of a custom WGSL material: a shader ref (inline WGSL or a
`ShaderHandle`), a compute `entryPoint`, and a typed `bindings` array reusing the
SAME `CustomWgslBindingDeclaration` union materials use (uniform-buffer /
storage-buffer / texture / sampler), bound to `@group(0)`.
`validateComputeKernelAsset` mirrors the material validator (structured
`computeKernel.*` diagnostics, never a throw), and `packComputeKernelUniformBytes`
std140-packs a uniform binding's `fields`/`values`. `CustomWgslShaderStage` gains
`"compute"` for kernel binding visibility; material binding validation still
restricts visibility to vertex/fragment, so custom materials keep byte-identical
pipeline keys.

The WebGPU backend realizes the dispatch (`realizeComputeKernelDispatch`) by
mirroring the custom-material pipeline realization for compute: it builds the
`layout: "auto"` compute pipeline (cached per resolved-source + entry point,
reused across frames) and resolves each binding through the EXISTING wiring — a
`storage-buffer` binding through C1's `resolveAppBufferAssetResource` (so a kernel
and a `material.storage(...)` binding referencing the same id share ONE realized
GPU buffer, zero-copy), a `uniform-buffer` binding through the std140 packer,
`texture`/`sampler` bindings through the app texture/sampler caches — then
`createBindGroup` from `pipeline.getBindGroupLayout(0)`. A kernel's WRITABLE
(`usage: "storage"`) storage outputs are auto-declared as the pass's frame-graph
writes, so a draw reading the same id is ordered after the dispatch
(writer-before-reader). Both the forward-graph route and the post-effect graph
route wire the realizer, mirroring how they already wire the compute pass's
`ctx.buffer` resolver.

The dispatch is an app-facade command that internally wraps the existing
`addComputePass` user-pass machinery (no new snapshot packet family; the
determinism fixtures are unchanged). Degradation is loud, never a device error:
a malformed kernel, an unresolved binding, a device without compute support, or a
pipeline/bind-group creation failure surfaces one of `computeKernel.invalidAsset`
/ `computeKernel.deviceUnavailable` / `computeKernel.shaderSourceUnavailable` /
`computeKernel.pipelineCreationFailed` / `computeKernel.bindingResourceUnavailable`
/ `computeKernel.bindGroupCreationFailed` on the frame, and the pass records no
commands.

Ships `examples/luminance-histogram`: a single-threaded luminance-histogram
kernel is dispatched TWO ways from the same input pixel buffer — a RAW
`addComputePass` dispatch (hand-built pipeline + bind group) and a DATA-DESCRIBED
`addComputeKernelPass` dispatch — into two storage buffers; the e2e reads both
back and asserts they are byte-identical (the data-described dispatch produces the
same GPU result as the hand-built one).
