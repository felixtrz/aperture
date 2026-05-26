# Current Task

No active task is currently checked out.

Status: task-3206 mixed current-texture plus MSAA reused dual-size off-screen
target route completed.

Key findings:

- Added `examples/mixed-msaa-reuse-dual-size.html` to the render-to-texture
  route family.
- The route creates an MSAA-enabled WebGPU app, renders two worker snapshots
  through the same primary renderer-owned off-screen
  `ViewPacket.renderTarget` handle while also extracting a current-texture
  camera and a differently sized secondary off-screen target, and displays the
  second resolved primary preview plus wide secondary preview with
  aspect-preserving mapping.
- `examples/render-to-texture.main.js` reports current/off-screen
  classifications, stable primary target key, secondary target dimensions,
  per-frame dimensions and draw counts, requested/resolved sample count,
  per-pass MSAA sample count, resolve attachment behavior, display quads, aspect
  mapping, reuse pressure, and current-texture readback.
- Playwright verified the current-texture sample plus both resolved previews are
  non-clear and visually distinct without stale first-frame pixels.

Recommended next task:

- `task-3207` — add a mixed current-texture plus MSAA resized reused
  viewport-cropped off-screen target route.
