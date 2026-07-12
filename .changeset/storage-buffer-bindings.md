---
"@aperture-engine/simulation": minor
"@aperture-engine/render": minor
"@aperture-engine/webgpu": minor
"@aperture-engine/runtime": minor
"@aperture-engine/app": minor
---

Storage-buffer bindings for custom WGSL materials (parity plan A2).
`BufferAsset` is a new renderer-independent buffer source (asset kind
`"buffer"`, `createBufferHandle`): a typed element schema
(`f32`/`vec2f`/`vec4f`/`u32`/`i32`; `vec3f` is rejected with a
`bufferAsset.vec3fUnsupported` diagnostic because its std430 storage-array
stride is 16 bytes), an element count, `read-only-storage` usage, and optional
typed-array initial data — validated by `validateBufferAsset` with structured
diagnostics and mirrored across the worker boundary like any source asset.
Worker systems register procedural buffers with `this.buffers.register(...)`
and bind them via the new `material.storage(name, { binding, visibility?,
buffer, runtimeBufferKey? })` builder; the buffer handle joins the material's
dependency declarations and readiness tracking. The WebGPU app route realizes
storage bindings as cached read-only `GPUBuffer`s (keyed by handle id + source
version, `STORAGE | COPY_DST`), so
`customWgslAppFrameResources.unsupportedBindingKind` no longer fires for
storage bindings backed by a ready buffer asset; missing/not-ready/mis-sized
dependencies produce dedicated `customWgslAppFrameResources.storageBuffer*`
diagnostics. Dynamic updates follow the RuntimeUniform pattern (DECISIONS.md
0022): a new `RuntimeBuffer` component (`aperture.render.runtimeBuffer`),
extracted `RuntimeBufferPacket`s on the render snapshot, the
`this.spawn.runtimeBuffer({ bufferKey, values, elementOffset? })` command, and
renderer-side `queue.writeBuffer` range writes with zero pipeline rebuilds
(only the binding kind participates in the pipeline key). Shared-array-buffer
snapshot transports fall back to transferable snapshots when runtime-buffer
packets are present, matching runtime uniforms. Ships with the
`examples/storage-buffer-grass.html` instanced-grass example.
