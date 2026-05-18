# Tracker/Backlog Alignment After Invalid Emissive-Factor glTF Mapping

Date: 2026-05-18

Task: `task-1614`

## Updates

- Marked `task-1610` through `task-1614` complete in `agent/BACKLOG.md`.
- Added ready follow-up tasks `task-1615` through `task-1619`.
- No public tracker percentage changed; this was focused render-bridge unit
  coverage for invalid material mapping diagnostics.

## Ready Queue

1. `task-1615` — plan next route or StandardMaterial follow-up after invalid
   emissive-factor mapping coverage.
2. `task-1616` — audit selected post-invalid-emissive follow-up plan.
3. `task-1617` — implement selected post-invalid-emissive follow-up.
4. `task-1618` — audit selected post-invalid-emissive implementation.
5. `task-1619` — audit tracker/backlog alignment after selected follow-up.

## Validation

- Pending: `pnpm run check:progress`

## Recommendation

Start with `task-1615`. Prefer moving away from emissive-factor coverage unless
the next plan identifies a directly adjacent defect.
