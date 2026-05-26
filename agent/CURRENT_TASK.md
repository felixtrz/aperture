# Current Task

No active task is currently checked out.

Status: task-3195 MSAA same-target clear/load route completed.

Key findings:

- Added `examples/render-target-msaa-clear-load.html` to the render-to-texture
  route family.
- The WebGPU frame boundary now supports storing an MSAA color attachment when a
  later pass in the same frame must load the same target.
- The route creates an MSAA-enabled WebGPU app, extracts two ECS cameras
  targeting the same renderer-owned off-screen `ViewPacket.renderTarget` handle,
  clears the first resolved boundary, then loads existing color/depth for the
  second resolved boundary.
- `examples/render-to-texture.main.js` reports requested/resolved sample count,
  target-key reuse, pass-order load ops, per-pass MSAA sample count, and resolve
  attachment behavior.
- Playwright verified the resolved clear-only, base-preserved, and overlay
  regions.

Recommended next task:

- `task-3196` — add an MSAA render-target viewport crop route.
