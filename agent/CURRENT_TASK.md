# Current Task

No active task is currently checked out.

Status: task-3190 mixed current-texture plus cropped secondary off-screen route completed.

Key findings:

- Added `examples/mixed-secondary-crop-render-targets.html` to the
  render-to-texture route family.
- The route extracts one current-texture camera plus two worker-authored ECS
  cameras targeting distinct renderer-owned `ViewPacket.renderTarget` handles
  while only the secondary off-screen target receives a non-full
  viewport/scissor crop.
- `examples/render-to-texture.main.js` displays the primary preview plus
  secondary inside/outside crop samples and reports target classifications, pass
  order, per-target keys, dimensions, draw counts, display samples,
  current-texture readback, and secondary target-space crop pixels.
- Playwright verified the current-texture sample, primary preview, secondary
  inside-crop preview, and secondary outside-clear region behave distinctly.

Recommended next task:

- `task-3191` — add a mixed current-texture plus MSAA two-target off-screen
  preview route.
