# Current Task

No active task is currently checked out.

Status: task-3174 render-target resize preview route completed.

Key findings:

- Added `examples/render-target-resize.html` using the existing
  render-to-texture main path.
- The route allocates a small renderer-owned off-screen target, replaces the
  same ECS `ViewPacket.renderTarget` handle with a larger GPU texture before
  rendering, and destroys the previous texture.
- Status now reports `renderTargetResize` with before/after dimensions, reused
  handle, texture recreation, previous texture destruction, and the
  stale-size guard used before rendering.
- Playwright verifies the resized target reports 384x384, the app render
  report uses the new dimensions, and the displayed preview remains non-clear.
- The latest all-route render-control smoke visited 57 routes, including
  `/examples/render-target-resize.html`, with zero route status failures and
  zero warning routes.

Recommended next task:

- `task-3175` — add a camera clear/load behavior matrix route.
