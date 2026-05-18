# Next Follow-Up Plan After GLB Combined BMR Normal Audit - 2026-05-18

## Scope

Audited the selected follow-up from
`NEXT_MATERIAL_ROUTE_OR_STANDARD_FOLLOW_UP_AFTER_GLB_COMBINED_BMR_NORMAL_PLAN_2026_05_18.md`.

Reference anchors inspected:

- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/NEXT_MATERIAL_ROUTE_OR_STANDARD_FOLLOW_UP_AFTER_GLB_COMBINED_BMR_NORMAL_PLAN_2026_05_18.md`
- `agent/BACKLOG.md`

## Findings

- The selected follow-up is concrete enough for one focused run: one new
  GLB-shaped StandardMaterial scenario plus one browser E2E test.
- The task preserves ECS authority and render extraction boundaries because it
  only adds source fixture data and app report assertions.
- The task keeps WebGPU resource ownership inside the existing built-in
  StandardMaterial path and does not introduce app-level generic adapter API
  changes.

## Recommendation

Implement `task-1444` next.
