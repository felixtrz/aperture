---
"@aperture-engine/webgpu": minor
"@aperture-engine/render": patch
---

Indirect-draw user surface (parity plan C2) — the analog of three.js WebGPU
`IndirectStorageBufferAttribute` / indirect draw, closing the GPU-driven-culling
loop on top of C1's writable buffers. A user render pass's `encode(ctx)` sink
gains `ctx.drawIndirect(indirectBuffer, indirectOffset)` and
`ctx.drawIndexedIndirect(indirectBuffer, indirectOffset)`: the draw's vertex and
instance counts are read on the GPU from an argument region — typically a
writable `BufferAsset` (`usage: "storage"`) a compute pass populated the same
frame (`ctx.buffer(id)` resolves it) — so the drawn instance count lives entirely
on the GPU and the CPU never authors it.

Writable buffers now realize with `INDIRECT` added to their usage flags
(`STORAGE | VERTEX | COPY_DST | COPY_SRC | INDIRECT`), so ONE GPU buffer serves
the compute writer, the storage/instance consumers (C1), and the indirect-draw
argument source. Read-only buffers keep their `STORAGE | COPY_DST` realization
byte-for-byte (pinned by a usage-flags test).

The drawn instance count is GPU-authoritative, so the WebGPU backend reads it
back off the argument buffer after the frame's submit (queue-ordered behind the
compute pass's writes) and surfaces it in the frame report: per pass at
`renderTargets[*].graph.userPasses[i].indirectDraws.drawnInstanceCount`, and as a
frame-wide aggregate `report.userIndirectDraws.drawnInstanceCount`. This is how an
e2e can assert that occluding/culling instances REDUCES the drawn count — it is
the only observable of a GPU-computed count.

A degraded indirect path never encodes a device error: the offending draw is
dropped and a structured `IndirectDrawFallbackReason` is reported (in
`report.userIndirectDraws.fallbackReasons` and as a frame warning). New reasons +
diagnostics: `indirect-buffer-unresolved`
(`indirectDraw.bufferUnresolved` — the buffer id was missing/not-ready),
`indirect-offset-misaligned` (`indirectDraw.offsetMisaligned` — offset not a
4-byte multiple), `indirect-readback-unavailable`
(`indirectDraw.readbackUnavailable`) and `indirect-readback-failed`
(`indirectDraw.readbackFailed` — the device could not read the count back; the
draw still runs, the count is reported as unknown). Both the forward-graph route
and the post route validate/filter user indirect draws; the GPU drawn-count
readback runs on the forward-graph route (its assembler is async).

Ships `examples/gpu-culling`: a compute pass culls a small instance set against a
CPU-driven threshold, compacts survivors, and writes the survivor count into an
indirect-argument buffer that a single `ctx.drawIndirect(...)` consumes; the e2e
asserts via the frame report that lowering the threshold reduces the drawn count.
