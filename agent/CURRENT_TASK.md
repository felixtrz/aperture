# Current Task

No active task is currently checked out.

Status: task-3176 picture-in-picture camera inset route completed.

Key findings:

- Added `examples/camera-picture-in-picture.html` and
  `examples/camera-picture-in-picture.worker.js`.
- The worker authors a full-canvas base ECS camera plus a higher-priority inset
  ECS camera over the same target, with binary-exact normalized inset
  viewport/scissor values.
- The shared multi-view main path now publishes route-level
  `pictureInPicture` status while reporting pass order, clear/load behavior,
  per-view viewport/scissor pixels, and layer-filtered included/skipped draws.
- Playwright verifies the base remains visible outside the inset while the
  inset center shows a distinct material color.
- Focused and shared multi-camera browser coverage passed for this slice.

Recommended next task:

- `task-3177` — add a render-target reuse stress preview route.
