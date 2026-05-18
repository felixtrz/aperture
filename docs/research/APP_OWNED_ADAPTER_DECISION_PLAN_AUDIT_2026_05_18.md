# App-Owned Adapter Decision Plan Audit

Date: 2026-05-18

Task: `task-1692`

## Scope

Audit the `task-1691` selected follow-up before implementation.

Reference files inspected:

- `docs/research/NEXT_APP_ADAPTER_DECISION_AFTER_ROUTE_DOCS_PLAN_2026_05_18.md`
- `docs/DECISIONS.md` Decision 0010
- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/DIAGNOSTICS_SUMMARIES.md`
- `docs/research/NON_BUILT_IN_APP_MATERIAL_ADAPTER_DECOMPOSITION_2026_05_18.md`

## Findings

- The selected decision-record task is concrete enough for one focused docs
  slice.
- It is appropriate to clarify the app facade boundary before adding any public
  app-owned adapter option.
- The plan preserves Decision 0010 by keeping route-family keys at the generic
  adapter/report boundary and requiring a separate custom source material
  contract before public adapter registration.
- The task should not change runtime code, app options, examples, shaders,
  pipelines, browser tests, or source material APIs.

## Recommendation

Implement `task-1693` as selected by adding a focused decision record to
`docs/DECISIONS.md`.
