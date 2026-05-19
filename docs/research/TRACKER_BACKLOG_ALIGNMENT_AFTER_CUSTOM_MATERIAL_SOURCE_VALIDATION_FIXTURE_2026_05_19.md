# Tracker Backlog Alignment After Custom Material Source Validation Fixture

Date: 2026-05-19

Task: `task-1720`

## Scope

Align the public tracker and ready backlog after drafting the source validation
fixture matrix.

Reference files inspected:

- `docs/index.html`
- `docs/render-pipeline-comparison.html`
- `docs/research/CUSTOM_MATERIAL_SOURCE_VALIDATION_FIXTURE_MATRIX_2026_05_19.md`
- `agent/BACKLOG.md`
- `docs/DECISIONS.md` Decision 0012
- `docs/ARCHITECTURE.md`

## Findings

- `docs/index.html` now records the fixture matrix and points the next focus at
  planning a validator helper or StandardMaterial/glTF fidelity slice.
- `docs/render-pipeline-comparison.html` now has a fresh status heading for the
  fixture matrix and groups it with the source validation taxonomy.
- The ready backlog has five categorized, scoped follow-ups after refill:
  `task-1721` through `task-1725`.

## Validation

Covered by final run-level validation for this automation cycle.

## Recommendation

Start `task-1721` next if the work window still has time: compare a deliberately
test-only validator helper, a StandardMaterial/glTF fidelity slice, and a
diagnostics/tooling slice after the fixture matrix.
