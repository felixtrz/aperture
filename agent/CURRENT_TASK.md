# Current Task

No active task is currently checked out.

Status: task-3202 mixed current-texture plus MSAA resized viewport-cropped
off-screen target route completed.

Key findings:

- Added `examples/mixed-msaa-resized-crop.html` to the render-to-texture route
  family.
- The route creates an MSAA-enabled WebGPU app, replaces the renderer-owned
  off-screen `ViewPacket.renderTarget` texture under the same ECS handle,
  extracts one current-texture camera plus one viewport-cropped off-screen
  camera targeting the resized handle, and displays the resolved cropped preview
  plus current-texture readback.
- `examples/render-to-texture.main.js` reports current/off-screen
  classifications, before/after dimensions, stable target key, crop rectangle
  and target-space pixels, requested/resolved sample count, per-pass MSAA sample
  count, resolve attachment behavior, display samples, and current-texture
  readback.
- Playwright verified the current-texture sample, inside-crop preview,
  outside-clear region, and screen-clear region are non-conflicting without
  stale-size sampling.

Recommended next task:

- `task-3203` — add a mixed current-texture plus MSAA reused viewport-cropped
  off-screen target route.
