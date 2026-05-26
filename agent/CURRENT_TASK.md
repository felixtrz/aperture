# Current Task

No active task is currently checked out.

Status: task-3198 mixed current-texture plus MSAA same-target clear/load route completed.

Key findings:

- Added `examples/mixed-msaa-clear-load.html` to the render-to-texture route
  family.
- The route creates an MSAA-enabled WebGPU app, extracts one current-texture
  camera plus two off-screen cameras targeting the same renderer-owned
  `ViewPacket.renderTarget` handle, stores the first off-screen MSAA boundary,
  and loads existing color/depth for the second same-target boundary.
- `examples/render-to-texture.main.js` reports current/off-screen
  classifications, target-key reuse, pass-order load ops, requested/resolved
  sample count, per-pass MSAA sample count, resolve attachment behavior, display
  samples, and current-texture readback.
- Playwright verified the current-texture sample, clear-only region,
  base-preserved region, and overlay region are non-conflicting.

Recommended next task:

- `task-3199` — add a mixed current-texture plus MSAA viewport-cropped
  off-screen target route.
