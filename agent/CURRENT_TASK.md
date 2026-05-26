# Current Task

No active task is currently checked out.

Status: task-3188 MSAA two-target off-screen preview route completed.

Key findings:

- Added `examples/render-target-msaa-two-targets.html` to the render-to-texture
  route family.
- The route creates an MSAA-enabled WebGPU app and extracts two worker-authored
  ECS cameras targeting distinct renderer-owned `ViewPacket.renderTarget`
  handles.
- `examples/render-to-texture.main.js` displays both resolved off-screen target
  textures side by side and reports requested/resolved sample counts,
  per-target keys, dimensions, draw counts, MSAA sample counts, and per-pass
  resolve attachment behavior.
- Playwright verified both resolved target previews are non-clear and visually
  distinct.

Recommended next task:

- `task-3189` — add an MSAA cropped secondary off-screen render-target preview
  route.
