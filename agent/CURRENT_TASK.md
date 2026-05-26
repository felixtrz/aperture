# Current Task

No active task is currently checked out.

Status: task-3170 camera render-layer isolation route completed.

Key findings:

- Added `examples/camera-render-layers.html` and
  `examples/camera-render-layers.worker.js`.
- The worker authors two ECS cameras with distinct layer masks over two
  overlaid mesh entities with distinct `RenderLayer` masks.
- The shared multi-view main path now supports opt-in per-view draw filtering,
  so each view command plan includes only mesh draws whose layer mask intersects
  that camera's layer mask.
- Status reports per-camera included/skipped draw counts and material keys,
  plus the layer-isolation scene contract.
- Playwright verifies red and blue viewport samples, one draw per camera, and
  one skipped draw per camera while preserving split-screen, orthographic, and
  line-route regressions.

Recommended next task:

- `task-3171` — add a camera priority overlay route.
