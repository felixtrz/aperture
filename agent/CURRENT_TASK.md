# Current Task

No active task is currently checked out.

Status: task-3194 MSAA render-target resize route completed.

Key findings:

- Added `examples/render-target-msaa-resize.html` to the render-to-texture route
  family.
- The route creates an MSAA-enabled WebGPU app and replaces the renderer-owned
  off-screen `ViewPacket.renderTarget` texture under the same ECS handle before
  rendering.
- `examples/render-to-texture.main.js` reports before/after dimensions, stable
  target key, texture recreation/destroy status, requested/resolved sample
  count, MSAA sample count, and resolve attachment behavior for the resized
  target.
- Playwright verified the resized resolved preview is non-clear without
  stale-size sampling.

Recommended next task:

- `task-3195` — add an MSAA same-target clear/load matrix route.
