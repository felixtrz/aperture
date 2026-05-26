# Current Task

No active task is currently checked out.

Status: task-3205 mixed current-texture plus MSAA resized same-target clear/load
off-screen target route completed.

Key findings:

- Added `examples/mixed-msaa-resized-clear-load.html` to the render-to-texture
  route family.
- The route creates an MSAA-enabled WebGPU app, replaces a renderer-owned
  off-screen `ViewPacket.renderTarget` texture under the same ECS handle,
  extracts one current-texture camera plus two off-screen cameras targeting the
  resized handle, clears/stores the first off-screen MSAA boundary, loads
  existing color/depth for the second same-target boundary, and displays the
  resolved clear/base/overlay regions plus current-texture readback.
- `examples/render-to-texture.main.js` reports current/off-screen
  classifications, before/after dimensions, stable target key, target-key reuse,
  pass-order load ops, requested/resolved sample count, per-pass MSAA sample
  count, resolve attachment behavior, display samples, resize status, and
  current-texture readback.
- Playwright verified the current-texture sample, clear-only region,
  base-preserved region, and overlay region are distinct without stale-size
  sampling.

Recommended next task:

- `task-3206` — add a mixed current-texture plus MSAA reused dual-size
  off-screen target route.
