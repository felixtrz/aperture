# Current Task

No active task is currently checked out.

Status: task-3175 camera clear/load behavior matrix route completed.

Key findings:

- Added `examples/camera-clear-load-matrix.html` and
  `examples/camera-clear-load-matrix.worker.js`.
- The worker authors three full-canvas ECS cameras over one target: an
  intentional zero-draw clear pass, a base pass, and an overlay pass.
- The shared multi-view main path now allows intentional expected-zero-draw
  views by suppressing only the `renderWorld.empty` diagnostic for those views.
- Status reports `clearLoadMatrix` with pass roles, priorities, layer masks,
  expected draw counts, clear/load behavior, material keys, and sample ids.
- Playwright verifies the clear-only sample stays at clear color, the
  base-preserved sample remains red, and the overlay sample is blue.
- The all-route render-control smoke was attempted after this slice but did
  not complete cleanly: one run timed out on `/examples/taa.html`, and a rerun
  hung until the validation process was killed. Focused Playwright and static
  validation for this slice passed.

Recommended next task:

- `task-3176` — add a picture-in-picture camera inset route.
