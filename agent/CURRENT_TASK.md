# Current Task

No active task is currently checked out.

Status: task-3191 mixed current-texture plus MSAA two-target route completed.

Key findings:

- Added `examples/mixed-msaa-two-targets.html` to the render-to-texture route
  family.
- The route creates an MSAA-enabled WebGPU app and extracts one current-texture
  camera plus two worker-authored ECS cameras targeting distinct renderer-owned
  `ViewPacket.renderTarget` handles.
- `examples/render-to-texture.main.js` displays both resolved off-screen target
  textures side by side and reports current/off-screen target classifications,
  requested/resolved sample counts, per-target keys, dimensions, draw counts,
  MSAA sample counts, per-pass resolve attachment behavior, display samples,
  and current-texture readback.
- Playwright verified the current-texture sample plus both resolved previews are
  non-clear and visually distinct.

Recommended next task:

- `task-3192` — add an MSAA mixed current-texture plus cropped secondary
  off-screen render-target route.
