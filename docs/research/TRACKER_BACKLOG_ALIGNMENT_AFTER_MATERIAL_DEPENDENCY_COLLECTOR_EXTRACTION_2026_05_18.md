# Tracker/Backlog Alignment After Material Dependency Collector Extraction

Date: 2026-05-18

Task: `task-1589`

## Updates

- Updated `docs/index.html` to mention the reusable app material dependency
  readiness collector.
- Updated `docs/render-pipeline-comparison.html` to include reusable dependency
  readiness diagnostic collection in the collect/status phase.
- Marked `task-1585` through `task-1589` complete in `agent/BACKLOG.md`.
- Added ready follow-up tasks `task-1590` through `task-1594`.

## Ready Queue

1. `task-1590` — plan next route or StandardMaterial follow-up after material
   dependency collector extraction.
2. `task-1591` — audit selected post-dependency-helper follow-up plan.
3. `task-1592` — implement selected post-dependency-helper follow-up.
4. `task-1593` — audit selected post-dependency-helper implementation.
5. `task-1594` — audit tracker/backlog alignment after selected follow-up.

## Validation

- `pnpm run check:progress`

## Recommendation

Start with `task-1590`. Compare one real route/prepared-resource cleanup
against one remaining StandardMaterial/glTF fidelity gap before adding another
diagnostics helper.
