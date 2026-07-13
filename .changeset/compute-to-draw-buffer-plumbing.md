---
"@aperture-engine/render": minor
"@aperture-engine/webgpu": minor
"@aperture-engine/app": minor
---

Compute→draw buffer plumbing (parity plan C1) — the analog of three.js WebGPU
`storage().toAttribute()` / compute-to-vertex plumbing, where a compute pass
feeds a draw with zero CPU copies. A `BufferAsset` gains a WRITABLE `usage:
"storage"` (the pre-C1 `"read-only-storage"` stays the default, byte-identical):
the WebGPU backend realizes ONE GPU buffer per handle@version with `STORAGE |
VERTEX | COPY_DST | COPY_SRC` and shares that identical buffer, zero-copy, across
every consumer. In one frame that buffer is: (1) WRITTEN by an
`app.addComputePass(...)` whose `ctx.buffer(id)` now resolves the realized
GPUBuffer (previously a stub returning `undefined`); (2) read as a
`material.storage(...)` binding; and (3) sourced as a buffer-backed
instance-attribute stream — `material.customWgsl({ instanceBuffer: { buffer,
attributes: defineInstanceAttributes([...]) } })` drives the slot-1
`stepMode: "instance"` vertex layout (`@location(6+)`) directly from the buffer
(no per-entity `InstanceData` packet, no CPU pack), the GPU counterpart to
CPU-authored instance data. The frame graph guarantees compute-before-draw: the
scene node declares a READ on each writable-buffer id the frame's draws consume,
so a compute pass writing the same id gets a writer-before-reader edge (a mutual
read/write is rejected as `frameGraph.cyclicDependency`). The buffer-backed
instance stream participates in the pipeline key only via the existing
`instance-attributes:<layoutKey>` segment (absent → `:none`), and the buffer
SOURCE never enters the key, so every pre-C1 material keeps a byte-identical
pipeline key. `this.buffers.register({ usage: "storage" })` opts a worker system
into the writable buffer. Validation ships as `customMaterialSource.invalidInstanceBuffer`
(instance stream must reference a buffer + at least one attribute, and is
mutually exclusive with CPU `instanceAttributes`) plus
`webGpuApp.instanceBufferSourceNotReady` / `webGpuApp.instanceBufferLayoutMismatch`.
Ships `examples/boids` (a GPU flocking simulation: a compute pass integrates
positions in the writable buffer, an instanced custom material renders the flock
consuming that buffer as BOTH a storage binding and the instance stream) with an
e2e that asserts entity/instance counts, a motion readback proving the positions
change on the GPU between two frames, and compute-before-draw ordering; plus a
headless determinism gate proving the seed→spawn authoring schedule is
reproducible (the GPU float positions are adapter-dependent and intentionally
never hashed).
