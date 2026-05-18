# Tracker Backlog Alignment After Mixed-Family Route Summary Shape

Date: 2026-05-18

Task: `task-1619`

## Scope

Align public tracker pages and the ready backlog after the mixed-family
routed-resource summary field-shape regression.

## Updates

- Updated `docs/index.html` to mention valid/invalid emissive-factor mapper
  coverage and the mixed-family route summary legacy-field guard.
- Updated `docs/render-pipeline-comparison.html` to reflect the latest route
  summary coverage.
- Refilled the ready backlog with `task-1620` through `task-1624`.

## Boundary Check

- The tracker changes are static GitHub Pages-compatible HTML only.
- No architecture or package boundary changes were made.
- The next ready queue favors route/prepared-resource cleanup planning before
  another fidelity fixture.

## Validation

- Run `pnpm run check:progress` after tracker edits.
