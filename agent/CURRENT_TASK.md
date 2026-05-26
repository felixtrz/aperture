# Current Task

No active task is currently checked out.

Status: task-3173 camera viewport grid route completed.

Key findings:

- Added `examples/camera-viewport-grid.html` and
  `examples/camera-viewport-grid.worker.js`.
- The worker authors four ECS cameras with normalized viewport/scissor
  quadrants over one world and four layer-masked colored planes sharing one
  prepared mesh resource.
- The shared multi-view main path now passes through route-level
  `viewportGrid` status with cell metadata, resolved viewport/scissor pixels,
  shared mesh key, material keys, expected draw counts, and sample ids.
- Playwright verifies all four grid-cell samples match distinct material colors
  while each camera reports one included draw and three skipped draws.
- The latest all-route render-control smoke visited 56 routes, including
  `/examples/camera-viewport-grid.html`, with zero route status failures and
  zero warning routes.

Recommended next task:

- `task-3174` — add a render-target resize preview route.
