# Tracker Backlog Alignment After Non-Built-In Adapter Decomposition

Date: 2026-05-18

Task: `task-1644`

## Scope

Align public tracker pages and the ready backlog after decomposing non-built-in
app material adapter support.

## Updates

- Updated `docs/index.html` to mention the decomposition and set the next focus
  to a new route/StandardMaterial planning slice.
- Updated `docs/render-pipeline-comparison.html` to mention the design-only
  non-built-in adapter decomposition in the queue phase status.
- Refilled the ready backlog with `task-1645` through `task-1649`.

## Boundary Check

- The tracker changes are static GitHub Pages-compatible HTML only.
- No architecture or package boundary changes were made in this alignment step.
- The ready queue points at the recommended generic app adapter contract audit
  while still requiring comparison against StandardMaterial/glTF and
  diagnostics/tooling candidates.

## Validation

- Run `pnpm run check:progress` after tracker edits.
