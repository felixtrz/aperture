# Next Route Or Standard Follow-Up After Omitted Sampler Coverage

Date: 2026-05-18

Task: `task-1580`

## Context

`task-1577` closed the omitted glTF sampler source/default mapping gap. The
recent run has added several StandardMaterial/glTF fidelity slices in a row, so
the next narrow step should return to material-route architecture without
starting broad collector migration.

## Candidates

### Generic Route / Prepared-Resource Candidate

Promote the app's private material-queue route-report diagnostic collector into
a reusable JSON-safe helper and route app summary creation through it.

Pros:

- Moves a small route-diagnostics responsibility out of `app.ts` without moving
  adapter policy or traversal.
- Reuses the already-established public `report` diagnostic field.
- Can be covered with focused unit tests over unknown diagnostics, malformed
  reports, and valid route reports.

Cons:

- It is a helper extraction rather than a material-family routing unlock.
- It should not grow into a broad collector rewrite.

Decision: select.

### StandardMaterial/glTF Fidelity Candidate

Add another small material-factor browser proof, such as emissive-factor-only
rendering.

Pros:

- Continues closing glTF material fidelity gaps.

Cons:

- Several fidelity slices just landed.
- The route helper is a smaller corrective architecture step after those
  browser additions.

Decision: defer.

### Diagnostics / Tooling Candidate

Only update tracker/backlog state after omitted sampler coverage.

Pros:

- Low risk.

Cons:

- Already handled by `task-1579`.
- Does not improve route architecture or runtime behavior.

Decision: complete; no tooling-only task now.

## Selected Follow-Up

### task-1582 — Extract material queue route report diagnostic collector

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu/src/webgpu/app-diagnostics-summary.ts`,
`packages/webgpu/src/webgpu/app.ts`, and
`test/webgpu/app-diagnostics-summary.test.ts`.
Reference anchor:
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_OMITTED_SAMPLER_PLAN_2026_05_18.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`packages/webgpu/src/webgpu/app.ts`,
`packages/webgpu/src/webgpu/material-queue-route-report.ts`, and
recent route diagnostics audits.

Acceptance criteria:

- Add a reusable helper that extracts a
  `webGpuApp.materialQueueRouteReport` diagnostic using the public `report`
  field.
- Ignore unknown diagnostics and malformed/non-object `report` values.
- Route app failure diagnostics summary creation through the helper.
- Add targeted tests proving valid extraction, null for missing/malformed
  diagnostics, and JSON-safe behavior.

## Next Step

Run `task-1581` to audit this selected follow-up before implementation.
