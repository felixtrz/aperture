# Tracker Backlog Alignment After Material Route Diagnostics Docs

Date: 2026-05-18

Task: `task-1690`

## Scope

Align the public tracker and ready backlog after documenting material route
diagnostics layers.

Reference files inspected:

- `docs/index.html`
- `docs/render-pipeline-comparison.html`
- `docs/DIAGNOSTICS_SUMMARIES.md`
- `agent/BACKLOG.md`
- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/MATERIAL_ROUTE_DIAGNOSTICS_DOCS_IMPLEMENTATION_AUDIT_2026_05_18.md`

## Findings

- `docs/index.html` now records that the public diagnostics docs include a
  material route diagnostics layer map.
- `docs/render-pipeline-comparison.html` now includes public route diagnostics
  docs in the queue phase status.
- The ready backlog has five categorized, scoped follow-ups: `task-1691`
  through `task-1695`.
- The next task should be `task-1691`, a planning slice that compares an
  app-owned adapter source/API decision candidate, a StandardMaterial/glTF
  fidelity candidate, and a diagnostics/tooling candidate.

## Validation

- `pnpm run check:progress`

## Recommendation

Start `task-1691` next if there is time before minute 47; otherwise wrap up.
