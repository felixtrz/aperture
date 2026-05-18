# Tracker Backlog Alignment After Route Summary Sorting Audit

Date: 2026-05-18

## Scope

Audit tracker and backlog alignment after the route summary diagnostic-code
sorting regression and audit.

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/ARCHITECTURE.md`
- `docs/index.html`
- `docs/render-pipeline-comparison.html`
- `agent/BACKLOG.md`
- `docs/research/ROUTE_SUMMARY_DIAGNOSTIC_CODE_SORTING_REGRESSION_AUDIT_2026_05_18.md`

## Findings

Pass after tracker and backlog updates.

The public tracker now calls out deterministic route summary diagnostic-code
sorting alongside the non-built-in and mixed-family route summary coverage. The
render pipeline comparison keeps all six phase-status entries and continues to
list real app-level non-built-in material routing as missing.

The ready backlog is refilled with five concrete categorized tasks:

- `task-1282` — plan route migration readiness or glTF fidelity after route
  determinism.
- `task-1283` — audit the selected plan.
- `task-1284` — audit material route migration readiness after route summary
  determinism.
- `task-1285` — plan next StandardMaterial/glTF fidelity diagnostic if route
  migration remains deferred.
- `task-1286` — audit tracker/backlog alignment after route determinism.

Each ready task includes category, package/write-scope, reference anchor, and
acceptance criteria.

## Recommendation

Start with `task-1282`. Route-summary criteria now have enough deterministic
coverage that the next plan should decide whether to audit app-level route
migration readiness or return to StandardMaterial/glTF fidelity diagnostics.

## Validation

- `pnpm run check:progress`
