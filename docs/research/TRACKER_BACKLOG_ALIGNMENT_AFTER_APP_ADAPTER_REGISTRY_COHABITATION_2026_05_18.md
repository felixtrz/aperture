# Tracker Backlog Alignment After App Adapter Registry Coexistence

Date: 2026-05-18

Task: `task-1680`

## Scope

Align the public tracker and ready backlog after the adapter registry
coexistence regression.

Reference files inspected:

- `docs/index.html`
- `docs/render-pipeline-comparison.html`
- `agent/BACKLOG.md`
- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/APP_ADAPTER_REGISTRY_COHABITATION_REGRESSION_AUDIT_2026_05_18.md`

## Findings

- `docs/index.html` now records the adapter registry coexistence guard and
  points the next focus at choosing between an explicit app-owned adapter facade
  and another StandardMaterial/glTF fidelity slice.
- `docs/render-pipeline-comparison.html` now reflects the queue-phase progress:
  built-in families and a test-only app-owned family can validate together at
  the generic adapter registry boundary with deterministic duplicate-family
  warnings and JSON-safe output.
- The ready backlog has five categorized, scoped follow-ups: `task-1681`
  through `task-1685`.
- The next task should be `task-1681`, a planning slice that compares an
  explicit app-owned adapter facade candidate against StandardMaterial/glTF and
  diagnostics alternatives without selecting public custom source material
  authoring unless a decision record is part of the plan.

## Validation

- `pnpm run check:progress`

## Recommendation

Start `task-1681` next.
