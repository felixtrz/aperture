# App-Facade Current-Texture Readback Plan - 2026-05-17

## Scope

Plan whether controlled app-facade browser examples should gain
current-texture readback support instead of relying on Playwright screenshots.

This is a planning slice. It does not change `WebGpuApp.render()`, frame
boundary assembly, app report JSON, or WebGPU resource ownership.

## References Inspected

- `examples/webgpu-readback.js`
- `examples/standard-texture-control.js`
- `test/e2e/standard-texture-control.spec.ts`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/frame-boundary.ts`
- `packages/webgpu/src/webgpu/current-texture-view.ts`
- `packages/webgpu/src/webgpu/clear-readback.ts`
- `docs/ARCHITECTURE.md`
- `docs/research/CONTROLLED_STANDARD_TEXTURE_BROWSER_BOUNDARY_AUDIT_2026_05_17.md`

## Current State

Lower-level examples that own command encoding can use `examples/webgpu-readback.js`
to configure `COPY_SRC`, copy selected current-texture pixels, and publish
readback samples. App-facade examples call `createWebGpuApp()` and
`app.render()`, which encapsulate current-texture acquisition and frame boundary
submission.

The new StandardMaterial texture control test therefore uses Playwright canvas
screenshots. That is acceptable for broad browser-visible differences, but it
is less precise than current-texture readback and less reusable for future
metallic-roughness or sampler assertions.

## Decision

Do not expose raw current textures, command encoders, queues, or GPU handles
from `WebGpuApp`.

The smallest future implementation should be an opt-in render option that asks
the app facade to collect readback samples while it already owns the frame
boundary:

```ts
app.render({
  frame,
  clearColor,
  readbackSamples: [{ id: "textured", x: 0.62, y: 0.5 }],
});
```

The returned report should include a JSON-safe readback section with sample ids,
pixel origins, decoded RGBA bytes, format, and failure reason/message when
readback is unavailable. It should not include buffers, textures, command
encoders, queues, backend cache maps, or WebGPU object references.

## Implementation Notes

- `createWebGpuApp()` already accepts `textureUsage` through
  `InitializeWebGpuOptions`; examples can opt into the existing readback canvas
  usage flag.
- The copy operation should live inside the WebGPU package near frame boundary
  assembly, where the current texture and command encoder are in scope.
- The public report shape should mirror the existing browser readback status
  convention but remain optional and omitted unless requested.
- Playwright screenshot tests should stay valid as a fallback when readback is
  unsupported by the browser/context configuration.

## Non-Goals

- No default readback on app frames.
- No app-level GPU object exposure.
- No new renderer state or scene graph ownership.
- No GLB material import, IBL, shadows, or texture-transform work.

## Follow-Up

Add an implementation task for optional app-facade readback samples once the
next run has enough time for a careful frame-boundary/report change and focused
browser coverage.
