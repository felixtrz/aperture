# Tracker Backlog Alignment After App-Owned Adapter Decision

Date: 2026-05-18

Task: `task-1695`

## Scope

Align the public tracker and ready backlog after adding Decision 0011.

Reference files inspected:

- `docs/index.html`
- `docs/render-pipeline-comparison.html`
- `docs/DECISIONS.md`
- `agent/BACKLOG.md`
- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/APP_OWNED_ADAPTER_DECISION_IMPLEMENTATION_AUDIT_2026_05_18.md`

## Findings

- `docs/index.html` now records Decision 0011 and points the next focus at
  source/API design or glTF fidelity.
- `docs/render-pipeline-comparison.html` now includes Decision 0011 in the
  queue phase status.
- The ready backlog has five categorized, scoped follow-ups: `task-1696`
  through `task-1700`.
- The next task should be `task-1696`, a planning slice that compares custom
  material source/API design, diagnostics examples/tooling, and
  StandardMaterial/glTF fidelity.

## Validation

- `pnpm run check:progress`

## Recommendation

Start `task-1696` next only if there is time before minute 47; otherwise wrap
up and let the next hourly run continue.
