# Current Task

No active task is currently checked out.

Status: task-3169 camera render-target preview route completed.

Key findings:

- `examples/render-to-texture.html` now explicitly reports the ECS source
  camera view, normalized viewport/scissor, off-screen render target key,
  target usage, display pass draw count, render-control capabilities, and clear
  colors.
- The route still renders a worker-authored ECS camera into a renderer-owned
  off-screen WebGPU texture via `ViewPacket.renderTarget`, then displays that
  texture in a second visible WebGPU pass.
- Playwright now samples the displayed preview and an untouched main-canvas
  clear region, proving the preview differs from both the main-canvas clear
  region and the off-screen clear color.
- Source-view color status is normalized to stable JSON values instead of
  leaking float32 precision noise from snapshot transport.

Recommended next task:

- `task-3170` — add a camera render-layer isolation route.
