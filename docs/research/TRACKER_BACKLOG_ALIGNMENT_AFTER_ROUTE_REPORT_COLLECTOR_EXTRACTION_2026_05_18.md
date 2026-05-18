# Tracker/Backlog Alignment After Route Report Collector Extraction

Date: 2026-05-18

Task: `task-1584`

## Updates

- Updated `docs/index.html` to mention the reusable material queue route-report
  diagnostic collector.
- Updated `docs/render-pipeline-comparison.html` to include reusable route
  report diagnostic collection in the prepare/status phase.
- Marked `task-1580` through `task-1584` complete in `agent/BACKLOG.md`.
- Added ready follow-up tasks `task-1585` through `task-1589`.

## Ready Queue

1. `task-1585` — plan next route or StandardMaterial follow-up after
   route-report collector extraction.
2. `task-1586` — audit selected post-route-helper follow-up plan.
3. `task-1587` — implement selected post-route-helper follow-up.
4. `task-1588` — audit selected post-route-helper implementation.
5. `task-1589` — audit tracker/backlog alignment after selected follow-up.

## Validation

- `pnpm run check:progress`

## Recommendation

Start with `task-1585`. The next plan should choose a focused follow-up without
turning the route collector cleanup into a broad migration.
