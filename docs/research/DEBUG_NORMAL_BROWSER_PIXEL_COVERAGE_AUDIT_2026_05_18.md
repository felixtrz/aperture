# DebugNormal Browser Pixel Coverage Audit

Date: 2026-05-18

## Scope

Audit the implemented DebugNormalMaterial browser example and Playwright pixel
coverage.

## References Inspected

- `docs/research/DEBUG_NORMAL_BROWSER_PIXEL_COVERAGE_PLAN_2026_05_18.md`
- `docs/research/DEBUG_NORMAL_BROWSER_PIXEL_COVERAGE_PLAN_AUDIT_2026_05_18.md`
- `docs/research/DEBUG_NORMAL_APP_ROUTE_INTEGRATION_AUDIT_2026_05_18.md`
- `docs/ARCHITECTURE.md`
- `examples/debug-normal-app.html`
- `examples/debug-normal-app.js`
- `test/e2e/debug-normal-app.spec.ts`
- `packages/webgpu/src/webgpu/debug-normal-shader.ts`

## Findings

- The implementation satisfies the selected browser slice. The example authors
  one camera, one mesh, and one DebugNormalMaterial through ECS components and
  typed render asset collections, then renders through `createWebGpuApp`.
- The Playwright regression verifies app status, `debug-normal` material queue
  summaries, routed resource summaries, draw counts, JSON safety, screenshot
  pixels, and readback pixels when readback is available.
- ECS authority remains intact. The browser example never creates renderer-owned
  scene nodes and does not bypass render extraction.
- WebGPU ownership remains isolated to the backend. The example consumes the app
  facade and status JSON rather than exposing raw GPU handles.
- Prepared DebugNormal cross-slot caching, non-built-in material adapter
  rendering, GLB loading, IBL, shadows, and GLB viewer behavior remain deferred.

## Validation

- `node --check examples/debug-normal-app.js`
- `pnpm run typecheck:test`
- `pnpm exec playwright test test/e2e/debug-normal-app.spec.ts`

## Recommendation

Update the public tracker/backlog alignment next, then plan the next material
route or DebugNormal follow-up.
