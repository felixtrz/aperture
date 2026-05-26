# Current Task

No active task is currently checked out.

Status: task-3192 MSAA mixed current-texture plus cropped secondary route completed.

Key findings:

- Added `examples/mixed-msaa-secondary-crop.html` to the render-to-texture route
  family.
- The route creates an MSAA-enabled WebGPU app and extracts one current-texture
  camera plus two worker-authored ECS cameras targeting distinct renderer-owned
  `ViewPacket.renderTarget` handles while only the secondary off-screen target
  receives a non-full viewport/scissor crop.
- `examples/render-to-texture.main.js` displays the resolved primary preview
  plus secondary inside/outside crop samples and reports current/off-screen
  target classifications, requested/resolved sample counts, per-target keys,
  dimensions, draw counts, MSAA sample counts, secondary crop pixels, per-pass
  resolve attachment behavior, display samples, and current-texture readback.
- Playwright verified the current-texture sample, primary resolved preview,
  secondary inside-crop preview, and secondary outside-clear region behave
  distinctly.

Recommended next task:

- `task-3193` — add an MSAA render-target reuse stress preview route.
