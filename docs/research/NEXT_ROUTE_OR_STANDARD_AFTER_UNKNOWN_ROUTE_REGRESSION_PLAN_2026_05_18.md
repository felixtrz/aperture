# Next route or StandardMaterial follow-up after unknown route regression - 2026-05-18

## Scope

Compare one route architecture candidate, one StandardMaterial/glTF fidelity
candidate, and one diagnostics/tooling candidate after the unsupported route
family regression.

Reference anchors inspected:

- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/DECISIONS.md`
- `docs/research/UNKNOWN_ROUTE_FAMILY_DIAGNOSTICS_REGRESSION_AUDIT_2026_05_18.md`
- `packages/webgpu/src/webgpu/material-queue-route-report.ts`
- `packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`

## Candidates

- Route architecture: audit route diagnostics nested report field naming
  consistency after the new test exposed `report` as the public field.
- StandardMaterial/glTF fidelity: add another sampler/color-space browser
  fixture.
- Diagnostics/tooling: extract route report JSON assertion helpers.

## Selection

Select the route architecture audit. The dependency browser track is now healthy
enough to pause, and the route diagnostics field shape should be clarified
before more app route diagnostics are added.

Selected follow-up: `task-1556` - audit route diagnostics report field naming
consistency.

## Validation

Planning-only task; covered by final formatting/check validation.
