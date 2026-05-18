# DebugNormal App Route Integration Audit

Date: 2026-05-18

## Scope

Audit the implemented DebugNormalMaterial app route resource integration.

## References Inspected

- `docs/research/ACTIVE_DEBUG_NORMAL_ROUTE_INTEGRATION_PLAN_2026_05_18.md`
- `docs/research/ACTIVE_DEBUG_NORMAL_ROUTE_INTEGRATION_PLAN_AUDIT_2026_05_18.md`
- `docs/research/DEBUG_NORMAL_APP_FRAME_RESOURCE_AUDIT_2026_05_18.md`
- `docs/ARCHITECTURE.md`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts`
- `packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`
- `packages/webgpu/src/webgpu/queued-built-in-frame-resource-set.ts`
- `packages/webgpu/src/webgpu/debug-normal-app-frame-resources.ts`
- `packages/webgpu/src/webgpu/debug-normal-pipeline.ts`
- `test/webgpu/webgpu-app.test.ts`
- `test/webgpu/queued-built-in-app-resource-set.test.ts`

## Findings

- The implementation satisfies the selected route-integration scope:
  DebugNormalMaterial is now a built-in material queue family, has app adapter
  callbacks, has pipeline resource creation, and uses
  `createOrReuseDebugNormalAppFrameResources()` from the app route path.
- ECS authority and render extraction remain intact. The route consumes
  extracted mesh draw packets, material handles, prepared source-asset facade
  keys, packed snapshot views, and packed transforms; it does not introduce a
  renderer-owned scene graph or gameplay state.
- WebGPU ownership remains isolated in `@aperture-engine/webgpu`. The new
  DebugNormal pipeline wrapper creates shader modules/pipelines and the app
  layout wiring requests group layouts from the renderer-owned pipeline handle.
- JSON-safe diagnostics and summaries are covered by targeted tests. The app
  facade now reports `debug-normal` in material queue and routed resource
  summaries, while unregistered family diagnostics still use the generic route
  failure report.
- Browser pixel verification, prepared DebugNormal cross-slot material caching,
  binary GLB loading, IBL, shadows, and GLB viewer behavior remain correctly
  deferred.

## Validation

- `pnpm exec vitest run test/webgpu/built-in-material-queue-family.test.ts test/webgpu/built-in-material-queue-adapter.test.ts test/webgpu/built-in-material-app-resource-adapter.test.ts test/webgpu/queued-built-in-app-resource-set.test.ts test/webgpu/queued-built-in-frame-resource-set.test.ts`
- `pnpm exec vitest run test/webgpu/debug-normal-pipeline-descriptor.test.ts test/webgpu/debug-normal-frame-resources.test.ts test/webgpu/debug-normal-app-frame-resources.test.ts`
- `pnpm exec vitest run test/webgpu/webgpu-app.test.ts -t "DebugNormalMaterial app resources|unregistered route family keys"`
- `pnpm run typecheck:test`
- `pnpm exec vitest run test/webgpu/webgpu-app.test.ts`
- `pnpm exec vitest run test/webgpu/built-in-material-queue-family.test.ts test/webgpu/built-in-material-queue-adapter.test.ts test/webgpu/built-in-material-app-resource-adapter.test.ts test/webgpu/queued-built-in-app-resource-set.test.ts test/webgpu/queued-built-in-frame-resource-set.test.ts test/webgpu/material-queue-route-report.test.ts test/webgpu/material-queue-route-report-json.test.ts`

## Recommendation

Update tracker/backlog alignment next, then plan a narrow DebugNormalMaterial
browser pixel slice over the active app route.
