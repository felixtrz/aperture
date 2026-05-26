# Current Task

No active task is currently checked out.

Status: task-3179 mixed canvas plus off-screen camera target route completed.

Key findings:

- Added `examples/mixed-camera-targets.html` to the render-to-texture route
  family.
- The worker extracts one current-texture camera and one off-screen
  `ViewPacket.renderTarget` camera from the same worker-authored ECS world.
- The main route submits both targets through renderer-owned resources, reports
  pass order and target keys, and displays the off-screen target in a follow-up
  preview pass.
- Status includes the app render readback for the current-texture camera and
  the display-pass readback for the off-screen preview.
- Playwright verifies the current-texture camera sample and displayed
  off-screen preview sample are distinct non-clear pixels.
- Focused render-to-texture coverage, static validation, build, typecheck,
  progress check, navigation, and all-route render-control smoke passed for
  this slice.

Recommended next task:

- `task-3180` — add a multiple off-screen render-target preview route.
