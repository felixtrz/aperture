# Tracker Backlog Alignment After Mixed-Family Route Regression Audit

Date: 2026-05-18

## Scope

Audit tracker and backlog alignment after the mixed-family route summary
aggregation regression and audit.

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/ARCHITECTURE.md`
- `docs/index.html`
- `docs/render-pipeline-comparison.html`
- `agent/BACKLOG.md`
- `docs/research/MIXED_FAMILY_ROUTE_SUMMARY_AGGREGATION_REGRESSION_AUDIT_2026_05_18.md`

## Findings

Pass after tracker and backlog updates.

The public tracker now calls out mixed-family route summary aggregation coverage
without claiming app-level non-built-in material adapter routing. The render
pipeline comparison keeps all six phase-status entries and lists real app-level
non-built-in routing as still missing.

The ready backlog is refilled with five concrete categorized tasks:

- `task-1277` — plan the next material route or glTF fidelity slice.
- `task-1278` — audit the selected plan.
- `task-1279` — add route summary diagnostic-code sorting regression.
- `task-1280` — audit that regression.
- `task-1281` — audit tracker/backlog alignment after diagnostic sorting.

Each ready task includes category, package/write-scope, reference anchor, and
acceptance criteria.

## Recommendation

Start with `task-1277`. The next plan should decide whether deterministic route
summary diagnostic-code sorting is the right next route slice or whether to
return to a narrow StandardMaterial/glTF fidelity diagnostic.

## Validation

- `pnpm run check:progress`
