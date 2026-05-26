# Current Task

No active task is currently checked out.

Status: task-3197 mixed current-texture plus MSAA resized off-screen target route completed.

Key findings:

- Added `examples/mixed-msaa-resize.html` to the render-to-texture route family.
- The route creates an MSAA-enabled WebGPU app, replaces the renderer-owned
  off-screen `ViewPacket.renderTarget` texture under the same ECS handle before
  rendering, and extracts one current-texture camera plus one off-screen camera
  targeting the resized handle.
- `examples/render-to-texture.main.js` reports current/off-screen
  classifications, before/after dimensions, stable target key, texture
  recreation/destroy status, requested/resolved sample count, MSAA sample count,
  resolve attachment behavior, display samples, and current-texture readback.
- Playwright verified the current-texture sample and resized resolved preview
  are non-clear and distinct without stale-size sampling.

Recommended next task:

- `task-3198` — add a mixed current-texture plus MSAA same-target clear/load
  route.
