# Tracker Backlog Alignment After Custom Material Source Shape Decision

Date: 2026-05-19

Task: `task-1710`

## Scope

Align the public tracker and ready backlog after adding Decision 0012.

Reference files inspected:

- `docs/index.html`
- `docs/render-pipeline-comparison.html`
- `docs/DECISIONS.md` Decision 0012
- `agent/BACKLOG.md`
- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`

## Findings

- `docs/index.html` now records Decision 0012 and points the next focus at
  planning source validation diagnostics or a StandardMaterial/glTF fidelity
  follow-up.
- `docs/render-pipeline-comparison.html` now has a fresh status heading for the
  source-shape decision and lists custom material source validation
  implementation as missing work.
- The ready backlog has five categorized, scoped follow-ups after refill:
  `task-1711` through `task-1715`.

## Validation

Covered by final run-level validation for this automation cycle.

## Recommendation

Start `task-1711` next if the work window still has time: compare a source
validation diagnostics slice, a StandardMaterial/glTF fidelity slice, and a
diagnostics/tooling slice after Decision 0012.
