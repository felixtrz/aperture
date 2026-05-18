# Generic Material Summary App Diagnostics Routing Audit - 2026-05-18

## Scope

Audit `task-1454`, which routes WebGPU app diagnostics through the generic
material frame-resource summary helper.

Reference anchors inspected:

- `docs/ARCHITECTURE.md`
- `docs/research/NEXT_MATERIAL_ROUTE_OR_STANDARD_FOLLOW_UP_AFTER_MULTI_TEXTURE_HELPER_PLAN_2026_05_18.md`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/queued-material-frame-resource-set-summary.ts`
- `packages/webgpu/src/webgpu/queued-built-in-resource-set-summary.ts`
- `test/webgpu/app-diagnostics-summary.test.ts`
- `test/webgpu/queued-built-in-resource-set-summary.test.ts`
- `test/webgpu/webgpu-app.test.ts`

## Findings

`createQueuedBuiltInAppDiagnosticsSummary()` now builds `routedResourceSet`
with `createQueuedMaterialFrameResourceSetSummary()`. The mapped summary input
still comes from derived `QueuedBuiltInAppResourceSet` items after render
extraction, material queueing, route preparation, and frame-resource assembly.

The public diagnostics shape is unchanged:

- `routedResourceSet.itemCount`
- `routedResourceSet.byFamily`
- `routedResourceSet.byPipeline`
- `routedResourceSet.byFamilyAndPipeline`

Built-in compatibility exports remain stable. The
`queued-built-in-resource-set-summary.ts` wrapper stays exported and tested, so
existing imports can continue to use it while the app diagnostics path consumes
the generic helper directly.

No product-facing custom material route was added. No source material kind,
pipeline key, GLB mapping, shader, IBL, shadow, or WebGPU resource ownership
behavior changed.

## Validation

- `pnpm exec prettier --check packages/webgpu/src/webgpu/app.ts docs/research/NEXT_MATERIAL_ROUTE_OR_STANDARD_FOLLOW_UP_AFTER_MULTI_TEXTURE_HELPER_PLAN_AUDIT_2026_05_18.md`
- `pnpm exec vitest run test/webgpu/app-diagnostics-summary.test.ts test/webgpu/queued-built-in-resource-set-summary.test.ts test/webgpu/webgpu-app.test.ts`
- `pnpm run typecheck:test`

## Recommendation

Proceed to tracker/backlog alignment. The public tracker may mention generic
summary cleanup if desired, but no material capability percentage needs to move.
