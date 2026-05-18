# Next route or StandardMaterial follow-up after delayed-dependency helper audit - 2026-05-18

## Scope

Compare one route architecture candidate, one StandardMaterial/glTF fidelity
candidate, and one diagnostics/tooling candidate after the delayed-dependency
helper audit.

Reference anchors inspected:

- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/DECISIONS.md`
- `docs/research/DELAYED_DEPENDENCY_BROWSER_ASSERTION_HELPER_AUDIT_2026_05_18.md`
- `docs/research/UNKNOWN_MATERIAL_ROUTE_FAMILY_DIAGNOSTICS_PLAN_AUDIT_2026_05_18.md`
- `test/webgpu/queued-built-in-app-resource-set.test.ts`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`

## Candidate A - Audit route diagnostics after unknown-family regression

Audit the new unknown-family route diagnostics regression and decide whether the
route boundary is ready to pause again.

Pros:

- Keeps the audit cadence after a route-boundary implementation.
- Low risk and likely to produce a clear next recommendation.

Risks:

- Documentation-only.

## Candidate B - StandardMaterial sampler/color-space follow-up

Return to glTF fidelity with another browser scenario around sampler or
color-space behavior.

Pros:

- User-facing and browser-verifiable.

Risks:

- Recent runs already added several dependency and normal-scale fidelity slices.
- Route-boundary implementation should be audited before adding more fidelity
  work.

## Candidate C - Delayed-dependency helper extraction

Extract a common no-work invariant helper from the delayed dependency tests.

Pros:

- Could reduce test duplication.

Risks:

- The helper audit found the slot-specific assertions more valuable than a
  broad abstraction right now.

## Selection

Select Candidate A.

Queued follow-up:

### task-1551 - Audit unknown route family diagnostics regression

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the `task-1550` implementation, `docs/DECISIONS.md` decision 0010,
`docs/ARCHITECTURE.md`, `test/webgpu/queued-built-in-app-resource-set.test.ts`,
`packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`, and
`packages/webgpu/src/webgpu/material-queue-route-report.ts`.

Acceptance criteria:

- Confirm the unknown-family regression preserves decision 0010 and does not
  imply public custom material source authoring.
- Confirm diagnostics are JSON-safe, grouped, and omit routed resources and raw
  handles.
- Recommend the next tracker/backlog or implementation follow-up.

## Validation

Planning-only task; covered by final formatting/check validation.
