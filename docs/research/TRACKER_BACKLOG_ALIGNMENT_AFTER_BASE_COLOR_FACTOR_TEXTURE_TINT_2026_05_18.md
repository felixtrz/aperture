# Tracker Backlog Alignment After Base-Color Factor Texture Tint

Date: 2026-05-18

Task: `task-1634`

## Scope

Align public tracker pages and the ready backlog after adding the glTF
base-color factor texture tint browser proof.

## Updates

- Updated `docs/index.html` to mention the new StandardMaterial/glTF
  `baseColorFactor` plus `baseColorTexture` browser coverage and set the next
  focus to a new route/StandardMaterial planning slice.
- Updated `docs/render-pipeline-comparison.html` to include base-color factor
  texture tint coverage in the prepare phase status.
- Refilled the ready backlog with `task-1635` through `task-1639`.

## Boundary Check

- The tracker changes are static GitHub Pages-compatible HTML only.
- No architecture or package boundary changes were made in this alignment step.
- The ready queue continues to compare route/prepared-resource cleanup against
  focused StandardMaterial/glTF fidelity work before implementation.

## Validation

- Run `pnpm run check:progress` after tracker edits.
