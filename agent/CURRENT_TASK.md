# Current Task

No active task is currently checked out.

Status: task-3180 multiple off-screen render-target preview route completed.

Key findings:

- Added `examples/multi-render-targets.html` to the render-to-texture route
  family.
- The worker extracts two ECS cameras from one worker-authored world. Each
  camera targets a distinct renderer-owned off-screen
  `ViewPacket.renderTarget` handle and filters a different render layer.
- The main route registers both target handles in renderer-owned assets,
  submits both off-screen passes through `createWebGpuApp()`, and displays both
  target textures side by side in one follow-up screen pass.
- Status includes `multiRenderTargets` with per-target dimensions, keys, draw
  counts, material/sample expectations, pass order, per-view target
  classification, and display-pass samples.
- Playwright verifies both displayed off-screen previews are non-clear and
  visually distinct.
- Focused render-to-texture coverage, static validation, build, typecheck,
  progress check, navigation, and all-route render-control smoke passed for
  this slice. The in-app Browser connector did not expose an `iab` browser in
  this session, so manual Browser verification was unavailable.

Recommended next task:

- `task-3181` — add an off-screen render-target viewport crop route.
