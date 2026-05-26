# Current Task

No active task is currently checked out.

Status: task-3187 mixed current-texture plus dual-size off-screen render-target route completed.

Key findings:

- Added `examples/mixed-dual-size-render-targets.html` to the render-to-texture
  route family.
- The worker now extracts one current-texture ECS camera plus two off-screen ECS
  cameras targeting square and wide renderer-owned `ViewPacket.renderTarget`
  handles from one snapshot.
- `examples/render-to-texture.main.js` displays the square and wide off-screen
  textures with aspect-preserving preview quads and reports
  `mixedDualSizeRenderTargets` status with target classifications, keys,
  dimensions, pass order, draw counts, display samples, aspect mapping, and
  current-texture readback.
- The official Chrome-channel Playwright project is currently blocked because
  Chrome hangs at `browser.newPage()` even for `about:blank`; a bundled
  Chromium Playwright assertion script verified the mixed-dual route status and
  target-family pixel samples.

Recommended next task:

- `task-3188` — add an MSAA two-target off-screen preview route.
