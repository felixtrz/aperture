# Current Task

No active task is currently checked out.

Status: task-3171 camera priority overlay route completed.

Key findings:

- Added `examples/camera-priority-overlay.html` and
  `examples/camera-priority-overlay.worker.js`.
- The worker authors two full-canvas ECS cameras sorted by priority: a base
  camera that draws a large layer and a higher-priority overlay camera that
  draws a smaller layer into the same target.
- The shared multi-view main path now reports ordered `cameraPassOrder`,
  per-view priority, and clear behavior (`target-cleared-before-view` for the
  first pass, `load-existing-target` for later passes).
- Playwright verifies the base-only sample remains visible while the center
  sample shows the higher-priority overlay.

Recommended next task:

- `task-3172` — add a camera sub-view/crop route.
