---
"@aperture-engine/webgpu": minor
"@aperture-engine/app": minor
---

Runtime texture updates — dynamic + video (parity plan D3) — the analog of
three.js `CanvasTexture` / `VideoTexture` / `DataTexture.needsUpdate`. A dynamic
texture's contents can now change every frame WITHOUT re-registering the asset or
re-uploading its bytes across the worker boundary. A worker system declares the
texture as DOM-free metadata — `this.textures.register({ id, width, height,
format?, externalImage?, data? })` (a `@aperture-engine/app` facade mirroring
`this.buffers.register`), which registers a renderer-independent `TextureAsset`
with `copy-dst` (and, for `externalImage`, `render-attachment`) usage that a
material samples by `createTextureHandle(id)`. The MAIN THREAD then owns the
uploads: `app.updateDynamicTexture(id, { data, bytesPerRow?, rowsPerImage?,
dataOffset?, region? })` applies a CPU-side full-image OR sub-rect update via
`queue.writeTexture` (AC1), and `app.updateDynamicTextureFromExternalImage(id, {
source, flipY?, sourceOrigin?, region? })` imports an `HTMLVideoElement` /
`VideoFrame` / canvas / `ImageBitmap` via `queue.copyExternalImageToTexture`
(AC2). A renderer-side `app.registerDynamicTexture(...)` is also provided for
textures sampled outside the extracted-material path. Because the ECS simulation
runs in a worker that must never touch the DOM, the entire upload path is an
app-facade feature — mirroring C3's `addComputeKernelPass` and B1's render-target
facade — so NO worker→renderer snapshot packet, packed-SAB encoding, or
determinism fixture changes (the determinism suite stays green with no refresh).
Byte-identity: a dynamic texture is a real `TextureAsset` that realizes
byte-for-byte like any texture with those usages, so every existing (non-dynamic)
texture is untouched; the frame report gains a `dynamicTextures` section (per-frame
update rate + bytes, cumulative totals, per-texture stats) only when at least one
dynamic texture has been registered, so unrelated apps keep a byte-identical
report. Every failure path — bad sub-rect, undersized data, sub-minimum
bytesPerRow, unsupported format, missing source, unrealized texture, device upload
failure — emits a structured, cataloged `dynamicTexture.*` diagnostic instead of a
raw WebGPU validation error. Ships `examples/runtime-texture`: an in-scene video
wall — one dynamic texture atlas (three stacked 64×64 regions) whose scoreboard
and TV regions are canvas-uploaded via `copyExternalImageToTexture` (a canvas
stands in for a video source; SwiftShader/headless has no video decode) and whose
ticker region is CPU-bytes-uploaded via `writeTexture` (full-region + sub-rect) —
with pixel-change e2e coverage proving the on-screen texels change between frames.
