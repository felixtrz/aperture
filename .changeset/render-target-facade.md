---
"@aperture-engine/render": minor
"@aperture-engine/webgpu": minor
"@aperture-engine/app": minor
---

Render-target authoring on the app facade (parity plan B1). A new data-only
`RenderTargetAsset` (`createRenderTargetAsset` / `validateRenderTargetAsset`,
with structured `renderTargetAsset.*` diagnostics) describes an offscreen
color target — `{ width, height, format: "swapchain" | concrete, msaa: 1|4,
depth, sampleable }` — and registers under the existing `render-target`
handle kind. Worker systems author targets through
`this.renderTargets.register/get/resize/colorTexture`; `spawn.camera({
renderTarget })` pairs a camera with one. `resize` republishes the same
handle (version bump), so camera pairings and texture bindings stay
handle-stable while the WebGPU backend destroys the old texture and realizes
the new one. Texture handles whose id matches a registered target resolve to
the realized color texture (custom-WGSL `material.texture`, sprites), with
offscreen views ordered before consumers via camera priority for same-frame
sampling. New renderer diagnostics: `webGpuApp.renderTargetMsaaUnavailable`,
`webGpuApp.renderTargetCreationFailed`,
`webGpuApp.renderTargetNotSampleable`. The low-level
`createWebGpuAppRenderTargetAsset` live-texture route is unchanged. New
`examples/minimap` (overhead ortho camera → facade target → screen-space HUD
quad) with e2e coverage; `docs/AUTHORING.md` gains a "Render Targets"
section.
