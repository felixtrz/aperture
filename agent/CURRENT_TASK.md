# Current Task

No active task is currently checked out.

Status: task-3201 mixed current-texture plus MSAA dual-size off-screen target route completed.

Key findings:

- Added `examples/mixed-msaa-dual-size.html` to the render-to-texture route
  family.
- The route creates an MSAA-enabled WebGPU app, extracts one current-texture
  camera plus two off-screen cameras targeting distinct renderer-owned
  `ViewPacket.renderTarget` handles with different dimensions, then resolves
  the square and wide off-screen textures for display.
- `examples/render-to-texture.main.js` reports current/off-screen
  classifications, per-target keys, dimensions, draw counts,
  requested/resolved sample count, per-pass MSAA sample count, resolve
  attachment behavior, display quads, aspect mapping, and current-texture
  readback.
- Playwright verified the current-texture sample plus both resolved previews are
  non-clear and visually distinct.

Recommended next task:

- `task-3202` — add a mixed current-texture plus MSAA resized viewport-cropped
  off-screen target route.
