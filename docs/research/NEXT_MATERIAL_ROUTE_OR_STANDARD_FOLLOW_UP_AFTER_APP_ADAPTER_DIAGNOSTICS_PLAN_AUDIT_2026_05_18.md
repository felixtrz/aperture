# Next Material Route Or Standard Follow-Up After App Adapter Diagnostics Plan Audit — 2026-05-18

## Scope

Audited the `task-1434` plan selecting app-level surfacing for built-in app
adapter validation diagnostics.

Reference anchors:

- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/DECISIONS.md` decision 0010
- `docs/research/NEXT_MATERIAL_ROUTE_OR_STANDARD_FOLLOW_UP_AFTER_APP_ADAPTER_DIAGNOSTICS_PLAN_2026_05_18.md`
- `packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts`
- `packages/webgpu/src/webgpu/app.ts`
- `references/three.js/src/renderers/common/Bindings.js`
- `references/engine/src/scene/materials/standard-material.js`

## Findings

- The selected follow-up is concrete enough for one focused run: surface the
  new adapter validation report through app diagnostics/reporting and prove both
  valid default and test-only invalid cases.
- The task preserves ECS authority because it stays in WebGPU app diagnostics and
  adapter metadata; it does not change source assets, ECS components, or
  extraction.
- The task preserves renderer ownership because it reports route/resource
  adapter validation state without exposing raw GPU handles or moving resources
  into ECS.
- The task aligns with decision 0010 by making malformed route-family
  registration inspectable rather than silently falling back.
- Scope boundaries are explicit: no app-level non-built-in rendering, no route
  renames, no GLB viewer work, no IBL/shadows, and no broad PBR work.

## Recommendation

Add `task-1436` to the ready backlog and implement it next. Pair it with a small
audit/tracker follow-up if public status changes.
