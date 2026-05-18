# Tracker Backlog Alignment After Generic App Adapter Registration Policy

Date: 2026-05-18

Task: `task-1657`

## Summary

The public tracker and backlog now reflect the generic app adapter registration
policy audit. The recommended next task is a generic app adapter registry
validation helper with targeted unit coverage.

## Updates

- Updated `docs/index.html` to list `task-1653` through `task-1657` as the
  latest completed work and to point the next focus at `task-1658`.
- Updated `docs/render-pipeline-comparison.html` so the queue phase references
  the registration-policy audit.
- Updated `agent/BACKLOG.md` to mark `task-1655` through `task-1657` complete
  and refill the ready queue with `task-1658` through `task-1662`.

## Ready Queue Check

At least five categorized and scoped ready tasks remain:

1. `task-1658` — generic app adapter registry validation helper.
2. `task-1659` — audit the validation helper.
3. `task-1660` — tracker/backlog alignment after the helper.
4. `task-1661` — plan the next route or StandardMaterial follow-up.
5. `task-1662` — audit the selected follow-up plan.

## Validation

Run `pnpm run check:progress` after tracker edits.
