# Tracker/Backlog Alignment After Emissive-Factor glTF Coverage

Date: 2026-05-18

Task: `task-1594`

## Updates

- Updated `docs/index.html` to mention emissive-factor-only glTF browser
  coverage and to recommend the next planning slice.
- Updated `docs/render-pipeline-comparison.html` to include the factor-only
  emissive StandardMaterial path in the prepare/status phase.
- Marked `task-1590` through `task-1594` complete in `agent/BACKLOG.md`.
- Added ready follow-up tasks `task-1595` through `task-1599`.

## Ready Queue

1. `task-1595` — plan next route or StandardMaterial follow-up after
   emissive-factor coverage.
2. `task-1596` — audit selected post-emissive-factor follow-up plan.
3. `task-1597` — implement selected post-emissive-factor follow-up.
4. `task-1598` — audit selected post-emissive-factor implementation.
5. `task-1599` — audit tracker/backlog alignment after selected follow-up.

## Validation

- `pnpm run check:progress`

## Recommendation

Start with `task-1595`. Give route/prepared-resource cleanup serious weight
before adding another StandardMaterial browser fixture.
