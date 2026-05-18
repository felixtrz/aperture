# DebugNormal App Frame Resource Audit

Date: 2026-05-18

## Scope

Audit the implemented DebugNormalMaterial app frame-resource cache/reuse helper.

## References Inspected

- `docs/research/NEXT_DEBUG_NORMAL_ROUTE_ACTIVATION_AFTER_FRAME_RESOURCES_PLAN_2026_05_18.md`
- `docs/research/DEBUG_NORMAL_APP_FRAME_RESOURCE_PLAN_AUDIT_2026_05_18.md`
- `packages/webgpu/src/webgpu/debug-normal-app-frame-resources.ts`
- `test/webgpu/debug-normal-app-frame-resources.test.ts`
- `packages/webgpu/src/webgpu/debug-normal-frame-resources.ts`
- `packages/webgpu/src/webgpu/unlit-app-frame-resources.ts`
- `packages/webgpu/src/webgpu/matcap-app-frame-resources.ts`
- `docs/ARCHITECTURE.md`

## Findings

- The implementation adds a focused app helper that wraps
  `createDebugNormalFrameGpuResources()` without activating app routing.
- Same-key cache reuse updates view and world-transform buffers in place when
  descriptor byte lengths match.
- Reuse counters follow the existing built-in app frame-resource shape and keep
  prepared-material counters at zero until a later prepared-material cache is
  selected.
- The helper consumes extracted/render-owned inputs and does not make the
  renderer own ECS/game state.

## Validation

- `pnpm exec vitest run test/webgpu/debug-normal-app-frame-resources.test.ts`

## Recommendation

Update tracker/backlog alignment, then plan active DebugNormalMaterial route
integration with route diagnostics and app resource summaries.
