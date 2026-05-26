# Current Task

No active task is currently checked out.

Status: task-3196 MSAA render-target viewport crop route completed.

Key findings:

- Added `examples/render-target-msaa-viewport-crop.html` to the render-to-texture
  route family.
- The route creates an MSAA-enabled WebGPU app, extracts one ECS camera
  targeting a renderer-owned off-screen `ViewPacket.renderTarget` handle with a
  non-full viewport/scissor rectangle, and resolves the cropped target texture
  into the visible preview.
- `examples/render-to-texture.main.js` reports requested/resolved sample count,
  crop rectangle and target-space pixels, target key, dimensions, draw count,
  MSAA sample count, color-target pressure, and resolve attachment behavior.
- Playwright verified the inside-crop resolved pixels render while the outside
  target-space sample remains the off-screen clear color.

Recommended next task:

- `task-3197` — add a mixed current-texture plus MSAA resized off-screen target
  route.
