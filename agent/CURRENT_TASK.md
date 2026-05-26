# Current Task

No active task is currently checked out.

Status: task-3184 dual-size off-screen render-target preview route completed.

Key findings:

- Added `examples/render-target-dual-size.html` to the render-to-texture
  route family.
- `examples/render-to-texture-assets.js` now defines a stable wide secondary
  off-screen target size for dual-size route coverage.
- The worker extracts two ECS cameras targeting two distinct renderer-owned
  off-screen `ViewPacket.renderTarget` handles with different target dimensions.
- `examples/render-to-texture.main.js` creates a square primary target and a
  wide secondary target, displays both textures side by side with
  aspect-preserving preview quads, and reports per-target dimensions, keys,
  draw counts, display samples, and aspect mapping.
- Playwright verifies both previews are non-clear, visually distinct, and not
  stretched into each other.

Recommended next task:

- `task-3185` — add an MSAA off-screen render-target preview route.
