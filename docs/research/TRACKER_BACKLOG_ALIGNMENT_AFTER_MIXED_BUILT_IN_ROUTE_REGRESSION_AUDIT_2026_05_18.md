# Tracker Backlog Alignment After Mixed Built-In Route Regression Audit

Date: 2026-05-18

## Scope

Audit public tracker and ready backlog alignment after `task-1338` added the
mixed built-in frame-resource route regression and `task-1339` audited it.

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/ARCHITECTURE.md`
- `docs/index.html`
- `docs/render-pipeline-comparison.html`
- `agent/BACKLOG.md`
- `docs/research/MIXED_BUILT_IN_FRAME_RESOURCE_ROUTE_REGRESSION_AUDIT_2026_05_18.md`

## Findings

Pass after tracker and backlog edits.

- The public tracker now records mixed built-in frame-resource route regression
  coverage over the generic collector.
- The render pipeline comparison page still has six phase-status entries and
  now describes deterministic mixed built-in family buckets and pipeline-scoped
  bind group coverage.
- The ready backlog is being refilled with categorized, scoped tasks for the
  next route/glTF planning group.

## Recommendation

Start the next planning task after this run: compare app-level mixed built-in
route diagnostics, a StandardMaterial/glTF fidelity diagnostic, and a
diagnostics/tooling option, then select one focused follow-up.

## Validation

- `pnpm run check:progress`
