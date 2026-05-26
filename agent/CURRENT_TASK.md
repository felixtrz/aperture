# Current Task

No active task is currently checked out.

Status: task-3185 MSAA off-screen render-target preview route completed.

Key findings:

- Added `examples/render-target-msaa.html` to the render-to-texture
  route family.
- The route creates `createWebGpuApp({ msaa: 8 })`, which resolves to the
  supported 4x MSAA path.
- The worker extracts one ECS camera targeting a renderer-owned off-screen
  `ViewPacket.renderTarget` handle.
- `examples/render-to-texture.main.js` reports requested/resolved sample counts,
  clamp status, target dimensions, draw counts, target MSAA sample count, and
  color attachment resolve behavior.
- Playwright verifies the displayed preview samples the resolved off-screen
  texture and differs from the main-canvas clear region.

Recommended next task:

- `task-3186` — add a cropped secondary off-screen render-target preview route.
