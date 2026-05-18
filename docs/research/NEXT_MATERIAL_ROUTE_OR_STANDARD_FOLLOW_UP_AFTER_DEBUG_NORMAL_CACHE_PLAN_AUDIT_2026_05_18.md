# Next Material Route Or Standard Follow-Up After DebugNormal Cache Plan Audit — 2026-05-18

## Scope

Audited the `task-1414` plan that selected generic built-in app resource
adapter registry smoke coverage as the next follow-up.

Reference anchors:

- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/DECISIONS.md`
- `docs/research/NEXT_MATERIAL_ROUTE_OR_STANDARD_FOLLOW_UP_AFTER_DEBUG_NORMAL_CACHE_PLAN_2026_05_18.md`
- `packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts`
- `packages/webgpu/src/webgpu/built-in-material-queue-adapter.ts`

## Findings

- The selected follow-up is concrete enough for one focused run: it asks for a
  typed registry smoke path and tests, not a route rewrite.
- The scope preserves ECS authority because it only audits app resource adapter
  metadata after extraction; it does not move source state into the renderer.
- The scope preserves render extraction and WebGPU-only ownership because it
  stays inside existing WebGPU adapter/resource wiring.
- The acceptance criteria explicitly defer non-built-in custom material
  rendering, route renames, GLB loading, IBL, shadows, and batching.
- The backlog refill now leaves at least five categorized, scoped ready tasks
  after this audit.

## Recommendation

Proceed with `task-1416`: add generic built-in app resource adapter registry
smoke coverage.
