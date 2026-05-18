# Tracker Backlog Alignment After Route Fixture Audit

Date: 2026-05-18

## Scope

Audit tracker and backlog alignment after the test-only non-built-in material
family route summary fixture and fixture audit.

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/ARCHITECTURE.md`
- `docs/index.html`
- `docs/render-pipeline-comparison.html`
- `agent/BACKLOG.md`
- `docs/research/TEST_ONLY_NON_BUILT_IN_ROUTE_SUMMARY_FIXTURE_AUDIT_2026_05_18.md`

## Findings

Pass after tracker and backlog updates.

The public tracker now calls out the route-summary fixture alongside the latest
glTF diagnostic work without claiming app-level non-built-in material routing.
The render pipeline comparison keeps all six phase-status entries and names the
test-only non-built-in route summary fixture as coverage, while leaving real
app-level non-built-in adapter migration in the missing list.

The ready backlog is refilled with five concrete categorized tasks:

- `task-1272` — plan the next material route or glTF fidelity slice.
- `task-1273` — audit the selected plan.
- `task-1274` — add mixed-family route summary aggregation regression.
- `task-1275` — audit that regression.
- `task-1276` — audit tracker/backlog alignment after the regression.

Each ready task includes category, package/write-scope, reference anchor, and
acceptance criteria.

## Recommendation

Start with `task-1272`. The next plan should decide whether to continue route
summary migration criteria with mixed-family aggregation coverage or return to a
narrow StandardMaterial/glTF fidelity diagnostic.

## Validation

- `pnpm run check:progress`
