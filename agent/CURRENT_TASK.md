# Current Task

No active task is currently checked out.

Status: task-3203 mixed current-texture plus MSAA reused viewport-cropped
off-screen target route completed.

Key findings:

- Added `examples/mixed-msaa-reuse-crop.html` to the render-to-texture route
  family.
- The route creates an MSAA-enabled WebGPU app, renders two worker snapshots
  through the same renderer-owned off-screen `ViewPacket.renderTarget` handle,
  extracts one current-texture camera in the same snapshots, applies a non-full
  viewport/scissor rectangle to the off-screen target, and displays the second
  resolved cropped preview plus current-texture readback.
- `examples/render-to-texture.main.js` reports current/off-screen
  classifications, stable target key, crop rectangle and target-space pixels,
  per-frame dimensions and draw counts, requested/resolved sample count,
  per-pass MSAA sample count, resolve attachment behavior, display samples, and
  current-texture readback.
- Playwright verified the current-texture sample, inside-crop preview,
  outside-clear region, and screen-clear region are non-conflicting without
  stale first-frame pixels.

Recommended next task:

- `task-3204` — add a mixed current-texture plus MSAA resized dual-size
  off-screen target route.
