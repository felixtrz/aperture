# Current Task

No active task is currently checked out.

Status: task-3200 mixed current-texture plus MSAA reused off-screen target route completed.

Key findings:

- Added `examples/mixed-msaa-reuse.html` to the render-to-texture route
  family.
- The route creates an MSAA-enabled WebGPU app, extracts one current-texture
  camera while rendering two worker snapshots through the same renderer-owned
  off-screen `ViewPacket.renderTarget` handle, then resolves the second
  off-screen texture for display.
- `examples/render-to-texture.main.js` reports current/off-screen
  classifications, stable target key, per-frame dimensions and draw counts,
  requested/resolved sample count, MSAA color texture creation/reuse pressure,
  per-frame resolve attachment behavior, display samples, and current-texture
  readback.
- Playwright verified the current-texture sample and second resolved preview are
  non-clear and distinct without stale first-frame pixels.

Recommended next task:

- `task-3201` — add a mixed current-texture plus MSAA dual-size off-screen
  target route.
