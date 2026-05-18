# Next Route Or glTF Fidelity After App-Level Mixed Route Summary Plan

Date: 2026-05-18

## Scope

Plan the next focused route or glTF fidelity slice after app-level mixed
unlit/matcap route summary coverage.

## References Inspected

- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/research/APP_LEVEL_MIXED_BUILT_IN_ROUTE_SUMMARY_REGRESSION_AUDIT_2026_05_18.md`
- `test/webgpu/webgpu-app.test.ts`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/queued-built-in-resource-set-summary.ts`

## Candidate Comparison

### Route / Prepared-Resource Candidate

Add app-level JSON diagnostics summary assertions for the existing successful
three-family unlit/standard/matcap route test.

Why now:

- The two-family unlit/matcap app summary is pinned.
- The app already has a successful unlit/standard/matcap rendering fixture that
  exercises direct lighting and all built-in material families.
- Adding JSON-safe `materialQueue`, `routedResourceSet`, and `directLighting`
  assertions to that fixture verifies the app-facing summary path across every
  built-in family without adding a new render path.

Expected scope:

- `test/webgpu/webgpu-app.test.ts`.
- No source asset schema, ECS component, render extraction, shader, WebGPU
  upload, or draw-submission behavior change unless a small focused defect is
  exposed.

### StandardMaterial / glTF Fidelity Candidate

Add a narrow invalid glTF material field diagnostic, such as another vector or
texture-info edge case.

Why defer:

- Recent runs already added invalid sampler, extension, scalar, texture scalar,
  vector/color, and no-resource browser diagnostics.
- The existing three-family app fixture gives a cheap way to pin a broader
  route summary that includes StandardMaterial direct-light readiness before
  returning to glTF fidelity.

### Diagnostics / Tooling Candidate

Add a tracker-only or route-summary helper audit.

Why defer:

- The tracker has been updated after both route summary slices.
- A helper-only diagnostic would add less confidence than pinning the existing
  app-facing three-family successful path.

## Selected Follow-Up

Select the route/prepared-resource candidate.

### task-1348 Selection

Category: `webgpu-render`

Package/write-scope: `test/webgpu/webgpu-app.test.ts`; implementation files
only if the regression exposes a focused defect.

Reference anchor:
`packages/webgpu/src/webgpu/app.ts`,
`packages/webgpu/src/webgpu/queued-built-in-resource-set-summary.ts`,
`test/webgpu/webgpu-app.test.ts`, and local WebGPU route/resource grouping
patterns in `references/engine` and `references/three.js`.

Acceptance criteria:

- Extend one successful three-family built-in WebGPU app test to assert
  `webGpuAppRenderReportToJsonValue(frame).diagnosticsSummary`.
- Assert `materialQueue` and `routedResourceSet` include unlit, matcap, and
  standard family counts plus deterministic pipeline groups.
- Assert the StandardMaterial `directLighting` summary remains present and
  ready.
- Assert JSON-safe serialization omits raw GPU handles, source asset payload
  labels, and route failure diagnostics on the successful path.
- Run the targeted WebGPU app test.

## Recommendation

Audit this plan next, then extend the existing three-family app route test if
the audit confirms the scope.
