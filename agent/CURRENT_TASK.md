# Current Task

No active task is currently checked out.

Status: task-3199 mixed current-texture plus MSAA viewport-cropped off-screen target route completed.

Key findings:

- Added `examples/mixed-msaa-target-crop.html` to the render-to-texture route
  family.
- The route creates an MSAA-enabled WebGPU app, extracts one current-texture
  camera plus one viewport-cropped off-screen camera targeting a renderer-owned
  `ViewPacket.renderTarget` handle, and resolves the cropped off-screen texture
  for display.
- `examples/render-to-texture.main.js` reports current/off-screen
  classifications, crop rectangle and target-space pixels, target key,
  dimensions, draw count, requested/resolved sample count, per-pass MSAA sample
  count, resolve attachment behavior, display samples, and current-texture
  readback.
- Playwright verified the current-texture sample, inside-crop preview,
  outside-clear region, and screen clear region are non-conflicting.

Recommended next task:

- `task-3200` — add a mixed current-texture plus MSAA reused off-screen target
  route.
