# Superseded DebugNormal Route Integration Plan Audit

Date: 2026-05-18
Status: superseded by the implemented DebugNormal app route and browser pixel
coverage slices. Retained as historical audit context.

## Scope

Audit the selected active DebugNormalMaterial app route integration plan.

## References Inspected

- `docs/research/SUPERSEDED_DEBUG_NORMAL_ROUTE_INTEGRATION_PLAN_2026_05_18.md`
- `docs/research/DEBUG_NORMAL_APP_FRAME_RESOURCE_AUDIT_2026_05_18.md`
- `docs/ARCHITECTURE.md`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts`
- `packages/webgpu/src/webgpu/debug-normal-app-frame-resources.ts`
- `packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`

## Findings

- The selected follow-up is concrete enough for one focused run if it stays on
  app resource wiring and targeted route-summary tests.
- The plan preserves ECS authority because it routes extracted material-family
  work through renderer-owned resource helpers; it does not add a scene graph or
  renderer-owned game state.
- The plan keeps WebGPU as the only backend and does not add browser pixels,
  GLB loading, IBL, or shadows.
- The main implementation risk is touching app route wiring. Tests should pin
  debug-normal family summaries and diagnostics so the route does not become a
  special-case bypass.

## Recommendation

Implement `task-1401` next, then audit route summaries before adding browser
pixel coverage.
