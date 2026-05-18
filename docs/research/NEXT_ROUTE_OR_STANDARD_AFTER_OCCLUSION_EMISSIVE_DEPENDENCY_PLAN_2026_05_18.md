# Next route or StandardMaterial follow-up after occlusion/emissive dependency coverage - 2026-05-18

## Scope

Compare one route architecture candidate, one StandardMaterial/glTF fidelity
candidate, and one diagnostics/tooling candidate after secondary texture
dependency browser coverage landed.

Reference anchors inspected:

- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/DECISIONS.md`
- `docs/research/OCCLUSION_EMISSIVE_DEPENDENCY_DIAGNOSTICS_BROWSER_COVERAGE_AUDIT_2026_05_18.md`
- `docs/research/GENERIC_MATERIAL_ROUTE_BOUNDARY_BEFORE_NON_BUILT_IN_APP_MIGRATION_AUDIT_2026_05_18.md`
- `packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`
- `packages/webgpu/src/webgpu/material-queue-route-report.ts`

## Candidate A - Route boundary unknown-family diagnostic fixture

Add a focused test-only route fixture proving an unknown material route family
produces JSON-safe app route diagnostics without exposing built-in-only fields,
source assets, app objects, or raw GPU handles.

Pros:

- Returns to the material-route architecture spine after several glTF fidelity
  slices.
- Aligns with decision 0010: route family keys are adapter routing metadata,
  not public custom material source authoring.
- Narrow and testable without activating real non-built-in rendering.

Risks:

- It is lower-level than the recent browser fixtures.
- It may need careful fixture construction to avoid implying custom material
  authoring is supported.

## Candidate B - Another StandardMaterial/glTF fidelity slice

Continue with a smaller glTF fidelity gap such as sampler/color-space matrix
coverage after the dependency diagnostics work.

Pros:

- User-facing and consistent with the recent browser verification track.

Risks:

- The texture dependency gaps are now substantially covered.
- More fidelity work before route cleanup increases the chance of keeping
  family-specific app route assumptions in place too long.

## Candidate C - Delayed-dependency assertion helper cleanup

Extract shared helpers for delayed-dependency browser assertions.

Pros:

- Would make the large Playwright file easier to maintain.

Risks:

- Mostly test hygiene; the slot-specific assertions are still readable.
- Helper extraction can wait until another dependency fixture is added.

## Selection

Select Candidate A.

Queued follow-up:

### task-1550 - Add unknown material route family diagnostics regression

Category: `webgpu-render`
Package/write-scope:
`test/webgpu/queued-built-in-app-resource-set.test.ts` or the nearest existing
route diagnostics test, with implementation files only if the regression exposes
a focused defect.
Reference anchor:
this plan, `docs/DECISIONS.md` decision 0010, `docs/ARCHITECTURE.md`,
`packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`,
`packages/webgpu/src/webgpu/material-queue-route-report.ts`,
`references/three.js/src/renderers/common/Bindings.js`, and
`references/engine/src/scene/materials/standard-material.js`.

Acceptance criteria:

- Add a test-only queued material route item or snapshot fixture with a valid
  but unsupported material family key.
- Assert the route report is invalid, includes
  `webGpuApp.unsupportedMaterialQueueFamily`, groups the skipped family/phase,
  appends no routed resources, and exposes no raw source assets, app objects, or
  GPU handles in JSON.
- Do not add public custom material source authoring or real non-built-in app
  rendering.

## Validation

Planning-only task; covered by final formatting/check validation.
