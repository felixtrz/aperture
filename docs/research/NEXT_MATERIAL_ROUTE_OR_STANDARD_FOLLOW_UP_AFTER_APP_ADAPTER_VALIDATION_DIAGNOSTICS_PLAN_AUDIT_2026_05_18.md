# Next Follow-Up Plan After App Adapter Validation Diagnostics Audit - 2026-05-18

## Scope

Audited the selected follow-up from
`NEXT_MATERIAL_ROUTE_OR_STANDARD_FOLLOW_UP_AFTER_APP_ADAPTER_VALIDATION_DIAGNOSTICS_PLAN_2026_05_18.md`.

Reference anchors inspected:

- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/NEXT_MATERIAL_ROUTE_OR_STANDARD_FOLLOW_UP_AFTER_APP_ADAPTER_VALIDATION_DIAGNOSTICS_PLAN_2026_05_18.md`
- `agent/BACKLOG.md`

## Findings

- The selected `task-1441` is concrete enough for one focused run: it is limited
  to the existing StandardMaterial browser fixture and E2E test.
- The task preserves ECS authority because it adds authored/glTF-shaped fixture
  data and app report assertions, not renderer-owned scene state.
- The task preserves the render extraction and WebGPU-only boundaries because it
  uses the existing built-in route, prepared texture/sampler resources, and app
  report JSON.
- The task is preferable to starting app-level non-built-in material rendering in
  the next run because generic app adapter injection still needs a separate API
  decision.

## Recommendation

Implement `task-1441` next after this run.
