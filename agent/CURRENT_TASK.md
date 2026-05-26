# Current Task

No active task is currently checked out.

Status: task-3208 mixed current-texture plus MSAA resized reused dual-size
off-screen target route completed.

Key findings:

- Added `examples/mixed-msaa-resized-reuse-dual-size.html` to the
  render-to-texture route family.
- The route creates an MSAA-enabled WebGPU app, replaces the primary
  renderer-owned off-screen `ViewPacket.renderTarget` texture under the same ECS
  handle, renders two worker snapshots through the resized primary handle while
  also extracting a current-texture ECS camera and a differently sized secondary
  off-screen target, and displays the second resolved resized primary preview
  plus wide secondary preview with aspect-preserving mapping.
- `examples/render-to-texture.main.js` reports current/off-screen
  classifications, before/after dimensions, stable primary target key,
  secondary target dimensions, per-frame dimensions and draw counts,
  requested/resolved sample count, per-pass MSAA sample count, resolve
  attachment behavior, display quads, aspect mapping, resize pressure, reuse
  pressure, and current-texture readback.
- Playwright verified the current-texture sample plus both resolved previews are
  non-clear and visually distinct without stale-size or stale first-frame
  pixels.

Recommended next task:

- `task-3209` — add a mixed current-texture plus MSAA reused same-target
  clear/load off-screen target route.
