# Current Task

No active task is currently checked out.

Status: task-3182 same off-screen render-target clear/load route completed.

Key findings:

- Added `examples/render-target-clear-load.html` to the render-to-texture route
  family.
- The worker extracts two ECS cameras that target the same renderer-owned
  off-screen `ViewPacket.renderTarget` handle from one worker-owned world.
- `createWebGpuApp()` now clears the first non-MSAA submission for a target and
  loads existing color/depth for later submissions to that same target during
  the same frame.
- The route reports per-camera pass order, actual color/depth attachment load
  ops, target-key reuse, display-pass samples, and expected clear/base/overlay
  colors.
- Playwright verifies the displayed target texture has a clear-only region, a
  preserved base region from the first camera, and a distinct overlay region
  from the second camera.

Recommended next task:

- `task-3183` — add a mixed current-texture plus two off-screen render-target
  route.
