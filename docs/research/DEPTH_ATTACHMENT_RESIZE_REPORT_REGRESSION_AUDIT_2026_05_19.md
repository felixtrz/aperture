# Depth Attachment Resize Report Regression Audit — 2026-05-19

## Result

`task-1767` added app-level unit coverage for depth attachment resize reporting.
The test renders with a 320x180 canvas, resizes the same app canvas to 640x360,
renders again, and asserts the JSON-safe `depthAttachment` report updates to
the new dimensions.

## Checks

- The depth texture remains owned by the WebGPU app resource cache.
- The report exposes format, attached status, dimensions, and opaque pipeline
  depth-write count only.
- The test confirms resized frames create one additional depth texture and
  texture view.
- No ECS/game state moved into the renderer, and no scene graph or public
  render-target API was added.

## Validation

- `pnpm exec vitest run test/webgpu/webgpu-app.test.ts test/webgpu/depth-texture-resource.test.ts`

## Recommendation

Proceed to planning the next renderer/material slice. The most likely
near-term candidates are occlusion/emissive transformed texture status
hardening or a small generic material-family contract audit.
