# Current Task

No active task is currently checked out.

Status: task-3209 mixed current-texture plus MSAA reused same-target clear/load
off-screen target route completed.

Key findings:

- Added `examples/mixed-msaa-reuse-clear-load.html` to the render-to-texture
  route family.
- The route creates an MSAA-enabled WebGPU app, renders two worker snapshots
  through the same renderer-owned off-screen `ViewPacket.renderTarget` handle
  while each snapshot extracts one current-texture ECS camera plus two off-screen
  ECS cameras targeting the same handle, clears/stores the first off-screen MSAA
  boundary, loads existing color/depth for the second boundary, and displays the
  second-frame resolved clear/base/overlay regions plus current-texture
  readback.
- `examples/render-to-texture.main.js` reports current/off-screen
  classifications, stable target key, target-key reuse, per-frame dimensions
  and draw counts, pass-order load ops, requested/resolved sample count,
  per-pass MSAA sample count, resolve attachment behavior, display samples,
  reuse pressure, and current-texture readback.
- Playwright verified the current-texture sample, clear-only region,
  base-preserved region, and overlay region are distinct without stale
  first-frame pixels.

Recommended next task:

- `task-3210` — add a mixed current-texture plus MSAA resized reused
  same-target clear/load off-screen target route.
