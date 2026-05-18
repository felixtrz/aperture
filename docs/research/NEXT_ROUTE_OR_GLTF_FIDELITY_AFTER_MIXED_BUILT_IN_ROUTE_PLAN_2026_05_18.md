# Next Route Or glTF Fidelity After Mixed Built-In Route Plan

Date: 2026-05-18

## Scope

Plan the next focused route or glTF fidelity slice after the mixed built-in
frame-resource regression.

## References Inspected

- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/research/MIXED_BUILT_IN_FRAME_RESOURCE_ROUTE_REGRESSION_AUDIT_2026_05_18.md`
- `test/webgpu/webgpu-app.test.ts`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/queued-built-in-frame-resource-set.ts`
- `packages/webgpu/src/webgpu/queued-built-in-resource-set-summary.ts`

## Candidate Comparison

### Route / Prepared-Resource Candidate

Add app-level JSON diagnostics summary assertions for mixed built-in routes.

Why now:

- `task-1338` pins mixed built-in frame-resource buckets at the internal
  wrapper level.
- Existing WebGPU app tests render mixed unlit/matcap and unlit/standard/matcap
  content, but the JSON-safe `diagnosticsSummary.routedResourceSet` shape is
  most clearly pinned on single-family StandardMaterial routes.
- The next route-spine risk is losing app-facing family/pipeline summary
  fidelity while the backend generic collector continues to evolve.

Expected scope:

- `test/webgpu/webgpu-app.test.ts`.
- No source asset schema, ECS component, render extraction, shader, WebGPU
  upload, or draw-submission behavior change unless a small focused defect is
  exposed.

### StandardMaterial / glTF Fidelity Candidate

Add a narrow StandardMaterial/glTF fidelity diagnostic such as another
alpha/double-sided or UV-set status assertion.

Why defer:

- Recent runs added several invalid glTF diagnostics and browser no-draw
  assertions.
- The mixed built-in route coverage has just moved from internal wrapper to app
  behavior; one app-facing summary regression is the more direct follow-up.

### Diagnostics / Tooling Candidate

Add another route-summary grouping or tracker-only diagnostic audit.

Why defer:

- Route summary grouping, deterministic diagnostic-code sorting, and public
  tracker freshness are already covered.
- The next diagnostics/tooling update should follow a user-visible app-summary
  assertion rather than adding another standalone summary helper test.

## Selected Follow-Up

Select the route/prepared-resource candidate.

### task-1343 Selection

Category: `webgpu-render`

Package/write-scope: `test/webgpu/webgpu-app.test.ts`; implementation files
only if the regression exposes a focused defect.

Reference anchor:
`packages/webgpu/src/webgpu/app.ts`,
`packages/webgpu/src/webgpu/queued-built-in-frame-resource-set.ts`,
`packages/webgpu/src/webgpu/queued-built-in-resource-set-summary.ts`,
`test/webgpu/webgpu-app.test.ts`, and local WebGPU route/resource grouping
patterns in `references/engine` and `references/three.js`.

Acceptance criteria:

- Add or extend one app-level mixed built-in route test to assert
  `webGpuAppRenderReportToJsonValue(frame).diagnosticsSummary`.
- Assert `materialQueue` and `routedResourceSet` include at least two built-in
  families, deterministic pipeline summaries, and family/pipeline group counts.
- Assert JSON-safe serialization omits raw GPU handles, source asset payload
  labels, and route failure diagnostics on the successful path.
- Run the targeted WebGPU app test.

## Recommendation

Audit this plan next, then implement the app-level mixed built-in route summary
regression if the audit confirms the scope.
