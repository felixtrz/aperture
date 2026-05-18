# Material Route Diagnostics Docs Plan Audit

Date: 2026-05-18

Task: `task-1687`

## Scope

Audit the `task-1686` selected follow-up before implementation.

Reference files inspected:

- `docs/research/NEXT_APP_ADAPTER_OR_DIAGNOSTICS_AFTER_COLLISION_POLICY_PLAN_2026_05_18.md`
- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/DECISIONS.md` Decision 0010
- `docs/research/MATERIAL_ROUTE_DIAGNOSTICS_MAP_2026_05_18.md`
- `docs/research/APP_ADAPTER_BUILT_IN_COLLISION_REGRESSION_AUDIT_2026_05_18.md`
- `docs/DIAGNOSTICS_SUMMARIES.md`

## Findings

- The selected follow-up is concrete and docs-only.
- Promoting the route diagnostics layer map into `docs/DIAGNOSTICS_SUMMARIES.md`
  is appropriate now that the route-report, prepare-route, frame-resource
  route, app-item, and summary layers have stable JSON-safe surfaces.
- The docs can preserve Decision 0010 by saying route-family strings at this
  layer are adapter/report keys only, not public custom material source assets.
- The work should not touch implementation, app options, shaders, browser
  examples, or source material APIs.

## Recommendation

Implement `task-1688` as selected. Keep it concise and focused on ownership
boundaries, JSON surfaces, and JSON-safety rules.
