# Current Task

No active task is currently checked out.

Status: task-3204 mixed current-texture plus MSAA resized dual-size off-screen
target route completed.

Key findings:

- Added `examples/mixed-msaa-resized-dual-size.html` to the render-to-texture
  route family.
- The route creates an MSAA-enabled WebGPU app, replaces the primary
  renderer-owned off-screen `ViewPacket.renderTarget` texture under the same ECS
  handle, extracts one current-texture camera plus a differently sized secondary
  off-screen target, and displays the resolved resized primary preview and wide
  secondary preview with aspect-preserving mapping plus current-texture
  readback.
- `examples/render-to-texture.main.js` reports current/off-screen
  classifications, before/after dimensions, stable primary target key,
  secondary target dimensions, requested/resolved sample count, per-pass MSAA
  sample count, resolve attachment behavior, display quads, aspect mapping, and
  current-texture readback.
- Playwright verified the current-texture sample plus both resolved previews are
  non-clear and visually distinct without stale-size sampling.

Recommended next task:

- `task-3205` — add a mixed current-texture plus MSAA resized same-target
  clear/load off-screen target route.
