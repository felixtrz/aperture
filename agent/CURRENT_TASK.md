# Current Task

No active task is currently checked out.

Status: task-3207 mixed current-texture plus MSAA resized reused
viewport-cropped off-screen target route completed.

Key findings:

- Added `examples/mixed-msaa-resized-reuse-crop.html` to the
  render-to-texture route family.
- The route creates an MSAA-enabled WebGPU app, replaces a renderer-owned
  off-screen `ViewPacket.renderTarget` texture under the same ECS handle,
  renders two worker snapshots through the resized handle while also extracting
  a current-texture ECS camera, applies a non-full viewport/scissor rectangle to
  the off-screen target, and displays the second resolved cropped preview plus
  current-texture readback.
- `examples/render-to-texture.main.js` reports current/off-screen
  classifications, before/after dimensions, stable target key, crop rectangle
  and pixels, per-frame dimensions and draw counts, requested/resolved sample
  count, per-pass MSAA sample count, resolve attachment behavior, display
  samples, resize pressure, reuse pressure, and current-texture readback.
- Playwright verified the current-texture sample, inside-crop preview,
  outside-clear region, and screen-clear region are distinct without stale-size
  or stale first-frame pixels.

Recommended next task:

- `task-3208` — add a mixed current-texture plus MSAA resized reused dual-size
  off-screen target route.
