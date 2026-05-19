# Tracker Backlog Alignment After Custom Material Source Validation Taxonomy

Date: 2026-05-19

Task: `task-1715`

## Scope

Align the public tracker and ready backlog after drafting the source validation
diagnostics taxonomy.

Reference files inspected:

- `docs/index.html`
- `docs/render-pipeline-comparison.html`
- `docs/research/CUSTOM_MATERIAL_SOURCE_VALIDATION_DIAGNOSTICS_TAXONOMY_2026_05_19.md`
- `agent/BACKLOG.md`
- `docs/DECISIONS.md` Decision 0012
- `docs/ARCHITECTURE.md`

## Findings

- `docs/index.html` now records the custom material source validation taxonomy
  and points the next focus at planning a source validation fixture or
  StandardMaterial/glTF fidelity slice.
- `docs/render-pipeline-comparison.html` now has a fresh status heading for the
  taxonomy and calls out the `customMaterialSource.*` diagnostic boundary.
- The ready backlog has five categorized, scoped follow-ups after refill:
  `task-1716` through `task-1720`.

## Validation

Covered by final run-level validation for this automation cycle.

## Recommendation

Start `task-1716` next if the work window still has time: compare a test-only
source validation fixture, a StandardMaterial/glTF fidelity slice, and a
diagnostics/tooling slice after the taxonomy.
