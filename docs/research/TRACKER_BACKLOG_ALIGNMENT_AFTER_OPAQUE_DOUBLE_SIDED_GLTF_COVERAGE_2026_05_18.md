# Tracker/Backlog Alignment After Opaque Double-Sided glTF Coverage

Date: 2026-05-18

Task: `task-1574`

## Updates

- Updated `docs/index.html` to mention opaque `doubleSided: true` glTF
  render-state mapping and backface browser coverage.
- Updated `docs/render-pipeline-comparison.html` to list opaque double-sided
  glTF coverage in the render pipeline status.
- Marked `task-1570` through `task-1574` complete in `agent/BACKLOG.md`.
- Added ready follow-up tasks `task-1575` through `task-1579`.

## Ready Queue

1. `task-1575` — plan next route or StandardMaterial follow-up after opaque
   double-sided coverage.
2. `task-1576` — audit selected post-opaque-double-sided follow-up plan.
3. `task-1577` — implement selected post-opaque-double-sided follow-up.
4. `task-1578` — audit selected post-opaque-double-sided implementation.
5. `task-1579` — audit tracker/backlog alignment after selected follow-up.

## Validation

- `pnpm run check:progress`

## Recommendation

Start with `task-1575`. The next planning slice should explicitly compare
returning to generic material-route architecture against one remaining narrow
StandardMaterial/glTF fidelity gap.
