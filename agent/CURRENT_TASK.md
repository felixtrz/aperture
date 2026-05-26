# Current Task

No active task is currently checked out.

Status: task-3189 MSAA cropped secondary off-screen preview route completed.

Key findings:

- Added `examples/render-target-msaa-secondary-crop.html` to the
  render-to-texture route family.
- The route creates an MSAA-enabled WebGPU app and extracts two worker-authored
  ECS cameras targeting distinct renderer-owned `ViewPacket.renderTarget`
  handles while only the secondary target receives a non-full viewport/scissor
  crop.
- `examples/render-to-texture.main.js` displays the resolved primary preview
  plus secondary inside/outside crop samples and reports requested/resolved
  sample counts, per-target keys, dimensions, draw counts, MSAA sample counts,
  secondary crop pixels, and per-pass resolve attachment behavior.
- Playwright verified the primary resolved preview is non-clear while the
  secondary resolved preview has distinct inside-rendered and outside-clear
  regions.

Recommended next task:

- `task-3190` — add a mixed current-texture plus cropped secondary off-screen
  render-target route.
