# Current Task

No active task is currently checked out.

Status: task-3183 mixed current-texture plus two off-screen render-target route completed.

Key findings:

- Added `examples/mixed-multi-render-targets.html` to the render-to-texture
  route family.
- The worker extracts three ECS cameras from one worker-owned world: one
  current-texture camera and two cameras targeting distinct renderer-owned
  off-screen `ViewPacket.renderTarget` handles.
- `examples/render-to-texture.main.js` displays both off-screen targets
  side-by-side and reports target classifications, keys, pass order, draw
  counts, display samples, and current-texture readback.
- `examples/render-to-texture-assets.js` now includes a third unlit material and
  stable current-texture sample point for the three-target route.
- Playwright verifies the current-texture sample plus both off-screen previews
  are non-clear and visually distinct.

Recommended next task:

- `task-3184` — add a dual-size off-screen render-target preview route.
