# Next Material Route Or DebugNormal Follow-Up Plan Audit

Date: 2026-05-18

## Scope

Audit the selected prepared DebugNormal material cache parity plan.

## References Inspected

- `docs/research/NEXT_MATERIAL_ROUTE_OR_DEBUG_NORMAL_AFTER_BROWSER_PLAN_2026_05_18.md`
- `docs/research/DEBUG_NORMAL_BROWSER_PIXEL_COVERAGE_AUDIT_2026_05_18.md`
- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `packages/webgpu/src/webgpu/prepared-unlit-material-cache.ts`
- `packages/webgpu/src/webgpu/prepared-matcap-material-cache.ts`
- `packages/webgpu/src/webgpu/prepared-standard-material-cache.ts`
- `packages/webgpu/src/webgpu/debug-normal-app-frame-resources.ts`

## Findings

- The selected follow-up is concrete enough for one focused run. It has a clear
  write scope and mirrors existing scalar/material cache patterns instead of
  inventing a new route architecture.
- ECS authority remains preserved. The cache would prepare renderer-owned
  DebugNormal GPU material resources from source material handles and versions;
  it would not store GPU resources on ECS components or change extraction.
- The slice is appropriately smaller than a generic route rename or custom
  material source API. Those broader changes still need an explicit public
  contract and should remain deferred.
- Tests should pin cache creation/reuse counters and JSON-safe cache summaries
  so DebugNormal resource lifetime matches the other built-in families without
  exposing raw GPU handles.

## Recommendation

Implement prepared DebugNormal material cache parity next as `task-1411`.
