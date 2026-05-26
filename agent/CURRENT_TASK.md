# Current Task

No active task is currently checked out.

Status: task-3172 camera sub-view/crop route completed.

Key findings:

- Added `examples/camera-sub-view-crop.html` and
  `examples/camera-sub-view-crop.worker.js`.
- The worker authors one ECS camera with matching normalized
  `Camera.viewport` and `Camera.scissor` values of
  `[0.25, 0.25, 0.5, 0.5]`.
- The shared multi-view main path now passes through route-level
  `subViewCrop` status so the resolved viewport/scissor pixel rectangle and
  expected readback samples are visible in browser status.
- Playwright verifies the crop-center sample renders the authored green
  material while top-left and bottom-right outside samples remain at the
  camera clear color.
- The all-route render-control smoke visited 55 routes, including
  `/examples/camera-sub-view-crop.html`, with zero route status failures and
  zero warning routes.

Recommended next task:

- `task-3173` — add a camera viewport grid route.
