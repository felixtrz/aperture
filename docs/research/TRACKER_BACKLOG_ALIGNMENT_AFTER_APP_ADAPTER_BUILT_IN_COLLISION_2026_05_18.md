# Tracker Backlog Alignment After App Adapter Built-In Collision

Date: 2026-05-18

Task: `task-1685`

## Scope

Align the public tracker and ready backlog after the built-in family collision
registry regression.

Reference files inspected:

- `docs/index.html`
- `docs/render-pipeline-comparison.html`
- `agent/BACKLOG.md`
- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/APP_ADAPTER_BUILT_IN_COLLISION_REGRESSION_AUDIT_2026_05_18.md`

## Findings

- `docs/index.html` now records that a colliding app-owned-style `standard`
  adapter cannot silently override the first built-in-style registration.
- `docs/render-pipeline-comparison.html` now includes the collision-policy
  guard in the queue phase status.
- The ready backlog has five categorized, scoped follow-ups: `task-1686`
  through `task-1690`.
- The next task should be `task-1686`, a planning slice that compares an
  explicit app-owned adapter facade candidate, a StandardMaterial/glTF fidelity
  candidate, and a diagnostics/tooling candidate.

## Validation

- `pnpm run check:progress`

## Recommendation

Start `task-1686` next.
