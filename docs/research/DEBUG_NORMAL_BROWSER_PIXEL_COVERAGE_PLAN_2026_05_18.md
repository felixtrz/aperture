# DebugNormal Browser Pixel Coverage Plan

Date: 2026-05-18

## Scope

Plan the next DebugNormalMaterial browser coverage slice after active app route
resource integration.

## References Inspected

- `docs/research/DEBUG_NORMAL_APP_ROUTE_INTEGRATION_AUDIT_2026_05_18.md`
- `docs/ARCHITECTURE.md`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`
- `test/e2e/webgpu-status.ts`
- `packages/webgpu/src/webgpu/debug-normal-shader.ts`
- `packages/webgpu/src/webgpu/app.ts`
- `test/webgpu/webgpu-app.test.ts`

## Candidate Comparison

### Browser Pixel Coverage

Add a narrow browser fixture that renders one ECS-authored cube with
DebugNormalMaterial through `createWebGpuApp`, samples one visible pixel, and
asserts the app status exposes the debug-normal material queue and routed
resource summaries.

Why now:

- Active app route resources are implemented and tested headlessly.
- The shader is intended to visualize world-space normals as RGB, so a pixel
  check is the right proof that the new route reaches real WebGPU submission.
- Existing browser examples already publish JSON-safe status and use readback
  samples for deterministic assertions.

### Route Diagnostics Coverage

Add more tests around DebugNormal queue diagnostics without browser rendering.

Why defer:

- The active route already has app-level summary coverage.
- The higher risk now is shader/pipeline/frame-resource integration in a real
  browser rather than another JSON-only route assertion.

### Prepared Material Cache Coverage

Add a prepared DebugNormal material cache similar to scalar unlit/matcap paths.

Why defer:

- DebugNormalMaterial has no texture dependencies and the app frame-resource
  cache already covers same-key reuse.
- A cross-slot material cache can follow if browser coverage shows repeated
  material-resource churn is a practical issue.

## Selected Follow-Up

Select browser pixel coverage.

### Proposed task-1406 — Add DebugNormalMaterial browser pixel coverage

Category: `webgpu-render`

Package/write-scope:
`examples/debug-normal-app.html`, `examples/debug-normal-app.js`,
`test/e2e/debug-normal-app.spec.ts`, and tracker updates if the rendered browser
slice lands.

Reference anchor:
`docs/research/DEBUG_NORMAL_BROWSER_PIXEL_COVERAGE_PLAN_2026_05_18.md`,
`examples/standard-gltf-texture.js`, `test/e2e/standard-gltf-texture.spec.ts`,
`packages/webgpu/src/webgpu/debug-normal-shader.ts`, and the active
DebugNormal route integration from `task-1401`.

Acceptance criteria:

- A browser example creates a `createWebGpuApp` scene with one camera, one mesh,
  and one `DebugNormalMaterial` authored through ECS components and typed
  assets.
- The example publishes JSON-safe status with `debug-normal` material queue and
  routed resource summaries, pipeline key, draw count, and no raw GPU handles.
- Playwright verifies the rendered pixel/readback sample is not clear and is
  consistent with the expected normal-encoded color for the sampled cube face.
- Keep prepared DebugNormal material cross-slot caching, GLB loading, IBL,
  shadows, and GLB viewer behavior deferred.

## Recommendation

Audit this plan next. If it passes, implement the browser fixture and
Playwright pixel regression in one focused slice.
