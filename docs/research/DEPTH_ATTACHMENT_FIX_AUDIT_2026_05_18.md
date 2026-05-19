# Depth Attachment Fix Audit — 2026-05-19

## Scope

Task `task-1761` attached a single app-owned WebGPU depth texture to the
existing forward render pass and plumbed `depth24plus` into every built-in app
pipeline family.

## Root Cause

- `assembleFrameBoundary` previously planned only color attachments, so app
  frames had no `depthStencilAttachment`.
- App pipeline creation passed a null depth format, causing
  `resolveWebGpuPipelineRenderState` to disable depth writes and compare
  `always`.
- Opaque overlap correctness therefore depended on sorted draw order rather
  than depth testing.

## Reference Anchors

- `references/three.js/build/three.webgpu.js`: WebGPU depth buffer lifecycle
  recreates a cached depth target when size/sample/depth state changes.
- `references/engine/src/platform/graphics/webgpu/webgpu-render-target.js`:
  render targets carry explicit depth attachments into the WebGPU render pass.

## Implementation

- Added `packages/webgpu/src/webgpu/depth-texture-resource.ts` with a small
  cache slot that creates, reuses, and destroys a `depth24plus` render
  attachment sized to the app canvas.
- Extended `assembleFrameBoundary` with an optional `depthTarget`, preserving
  color-only callers while allowing `createWebGpuApp` to attach depth.
- Plumbed `WEBGPU_APP_DEPTH_FORMAT` into built-in app pipeline creation for
  unlit, standard, matcap, and debug-normal pipelines.
- Added JSON-safe `depthAttachment` render-report data with format, attached
  status, dimensions, and opaque pipeline depth-write count.
- Added `examples/depth-app-overlap.*` plus Playwright coverage proving a near
  unlit cube remains visible when a farther standard cube is rendered later.

## Validation

- `pnpm exec vitest run test/webgpu/depth-texture-resource.test.ts test/webgpu/material-render-state.test.ts test/webgpu/webgpu-app.test.ts`
- `pnpm run check:examples`
- `pnpm run typecheck`
- `pnpm run typecheck:test`
- `pnpm exec playwright test test/e2e/depth-app-overlap.spec.ts`

## Boundary Check

The depth resource is WebGPU-private derived render state. It does not add a
scene graph, renderer-owned ECS state, public render-graph API, WebGL fallback,
IBL, shadows, binary GLB loading, or public custom material facades.

## Recommendation

Proceed with the focused depth-attachment audit, then plan the next
renderer/material architecture slice.
