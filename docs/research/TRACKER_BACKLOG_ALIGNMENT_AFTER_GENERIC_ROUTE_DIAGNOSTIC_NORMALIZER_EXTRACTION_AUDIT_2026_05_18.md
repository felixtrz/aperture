# Tracker Backlog Alignment After Generic Route Diagnostic Normalizer Extraction Audit - 2026-05-18

## Scope

Confirm tracker and backlog alignment after the generic route diagnostic
normalizer extraction.

Reference anchors inspected:

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/GENERIC_ROUTE_DIAGNOSTIC_NORMALIZER_EXTRACTION_AUDIT_2026_05_18.md`
- `agent/BACKLOG.md`
- `docs/index.html`
- `docs/render-pipeline-comparison.html`

## Findings

The tracker should mention that the route-report diagnostic path now has both a
generic builder and a generic unknown-diagnostic normalizer. This is a queue/app
diagnostics cleanup, so phase percentages do not need to change.

The backlog should move the completed planning, audit, and implementation tasks
out of the recommended queue and point the next run at a fresh planning task.
The next planning task should compare a remaining material-route architecture
cleanup against StandardMaterial/glTF fidelity and diagnostics/tooling work.

## Changes To Make

- Update `docs/index.html` freshness, current status, latest work, and next
  focus.
- Update `docs/render-pipeline-comparison.html` queue-phase status text.
- Mark completed tasks and add at least five categorized ready tasks in
  `agent/BACKLOG.md`.
- Run `pnpm run check:progress`.

## Validation

Pending tracker edits and `pnpm run check:progress`.
