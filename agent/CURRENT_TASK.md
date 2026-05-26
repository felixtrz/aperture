# Current Task

No active task is currently checked out.

Status: task-3181 off-screen render-target viewport crop route completed.

Key findings:

- Added `examples/render-target-viewport-crop.html` to the render-to-texture
  route family.
- The worker extracts one ECS camera targeting a renderer-owned off-screen
  `ViewPacket.renderTarget` handle and applies matching non-full normalized
  viewport/scissor rectangles authored through ECS camera state.
- The main route registers the target handle in renderer-owned assets, submits
  the off-screen pass through `createWebGpuApp()`, displays the target texture
  on the canvas, and reports resolved target-space viewport/scissor pixels.
- `assembleFrameBoundary()` now applies resolved viewport and scissor
  rectangles to WebGPU render-pass encoders before draw commands, with typed
  diagnostics for invalid rectangles or missing pass methods.
- Status includes `offscreenTargetCrop` with target classification, dimensions,
  draw counts, source-view crop metadata, display-pass samples, and expected
  inside/outside colors.
- Playwright verifies the inside cropped-target sample renders while the
  outside-crop target sample remains the off-screen clear color.

Recommended next task:

- `task-3182` — add a same off-screen target clear/load matrix route.
