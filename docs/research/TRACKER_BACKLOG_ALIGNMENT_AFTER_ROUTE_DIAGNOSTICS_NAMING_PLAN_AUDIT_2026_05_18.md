# Tracker Backlog Alignment After Route Diagnostics Naming Plan Audit

Date: 2026-05-18

Task: `task-1559`

## Scope

Align the public tracker and ready backlog after the route diagnostics naming
audit and follow-up plan selected valid non-default glTF sampler mapping browser
coverage.

## Updates

- Updated `docs/index.html` to summarize the route diagnostics field naming
  audit and point the next focus at valid non-default glTF sampler mapping
  coverage.
- Updated `docs/render-pipeline-comparison.html` to note that public route
  diagnostics use `report` while `routeReport` remains internal scratch
  terminology.
- Updated `agent/BACKLOG.md` so completed route naming planning/audit work is
  marked and the ready queue includes `task-1561` through `task-1563`.

## Ready Queue Check

At least five categorized, scoped ready tasks remain:

1. `task-1560` — audit tracker freshness after route diagnostics naming track.
2. `task-1561` — add valid non-default glTF sampler mapping browser coverage.
3. `task-1562` — audit valid non-default sampler mapping browser coverage.
4. `task-1563` — audit tracker/backlog alignment after valid sampler mapping
   coverage.
5. Existing lower-priority post-proof tasks remain deferred under the backlog's
   strategic focus rules.

## Validation

Run `pnpm run check:progress` after formatting.
