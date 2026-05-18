# Tracker Backlog Alignment After Invalid Material Scalar Audit

Date: 2026-05-18

## Scope

Audit tracker and backlog alignment after the invalid glTF material scalar
browser diagnostic fixture and audit.

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/ARCHITECTURE.md`
- `docs/research/INVALID_GLTF_MATERIAL_SCALAR_BROWSER_DIAGNOSTIC_AUDIT_2026_05_18.md`
- `agent/BACKLOG.md`
- `docs/index.html`
- `docs/render-pipeline-comparison.html`

## Findings

Pass. The tracker now reflects invalid StandardMaterial scalar-factor
diagnostics and points the next focus back to post-diagnostics material or route
planning.

The ready backlog has at least five concrete tasks after refill:

- `task-1320` plans the next post-diagnostics material or route slice.
- `task-1321` audits that plan.
- `task-1322` implements the selected follow-up.
- `task-1323` audits the selected implementation.
- `task-1324` aligns tracker/backlog state after the selected implementation.
- `task-1325` plans the next material route or glTF fidelity slice.

Boundary checks:

- App-level non-built-in material rendering remains deferred.
- Binary GLB loading, IBL, shadows, and GLB viewer behavior remain deferred.
- Immediate tasks remain planning, diagnostics, or a selected narrow follow-up.

## Validation

- `pnpm run check:progress`
