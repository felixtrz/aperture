# Tracker Backlog Alignment After Custom Material Source Validation Test Helper

Date: 2026-05-19

Task: `task-1725`

## Scope

Align the public tracker and ready backlog after adding the test-only source
validation fixture.

Reference files inspected:

- `docs/index.html`
- `docs/render-pipeline-comparison.html`
- `test/materials/custom-material-source-validation-fixture.test.ts`
- `agent/BACKLOG.md`
- `docs/DECISIONS.md` Decision 0012
- `docs/ARCHITECTURE.md`

## Findings

- `docs/index.html` now records the test-only source validation fixture and
  points the next focus at planning a package validator or StandardMaterial/glTF
  fidelity slice.
- `docs/render-pipeline-comparison.html` now has a fresh status heading for the
  executable source validation fixture.
- The ready backlog has five categorized, scoped follow-ups after refill:
  `task-1726` through `task-1730`.

## Validation

Covered by final run-level validation for this automation cycle.

## Recommendation

Start `task-1726` next if the work window still has time: compare a
package-level custom material source validator, a StandardMaterial/glTF fidelity
slice, and a diagnostics/tooling slice after the test fixture.
