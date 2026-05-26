# Current Task

No active task is currently checked out.

Status: task-3178 camera viewport resize matrix route completed.

Key findings:

- Added `examples/camera-viewport-resize.html` and
  `examples/camera-viewport-resize.worker.js`.
- The worker extracts two snapshots from one ECS camera handle after mutating
  its `Camera.viewport` and `Camera.scissor` component vectors between frames.
- The shared split-screen main route now renders and reads back both snapshots
  for this route, then reports old/new normalized rectangles, resolved
  viewport/scissor pixels, pass order, stable mesh authoring, and per-frame
  samples.
- Playwright verifies the material sample moves from the old viewport center to
  the new viewport center while the opposite sample remains clear in each
  frame.
- Focused route coverage, the shared camera Playwright set, static validation,
  build, typecheck, progress check, and all-route render-control smoke passed
  for this slice.

Recommended next task:

- `task-3179` — add a mixed canvas plus off-screen camera target route.
