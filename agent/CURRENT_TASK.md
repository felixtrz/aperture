# Current Task

No active task is currently checked out.

Status: task-3186 cropped secondary off-screen render-target preview route completed.

Key findings:

- Added `examples/render-target-secondary-crop.html` to the render-to-texture
  route family.
- The worker now extracts two ECS cameras targeting distinct renderer-owned
  off-screen `ViewPacket.renderTarget` handles while only the secondary target
  applies the non-full normalized viewport/scissor crop.
- `examples/render-to-texture.main.js` displays both textures side by side and
  reports `croppedSecondaryRenderTargets` status with per-target keys,
  dimensions, draw counts, display samples, and resolved secondary target-space
  crop pixels.
- Playwright verifies the primary preview is non-clear, the secondary
  inside-crop sample renders, and the secondary outside-crop sample remains the
  off-screen clear color.

Recommended next task:

- `task-3187` — add a mixed current-texture plus dual-size off-screen
  render-target route.
