# Next Route Or glTF Fidelity After Dependency Failure Plan

Date: 2026-05-18

## Scope

Plan the next focused material route or glTF fidelity slice after the generic
frame-resource dependency-failure route regression.

## References Inspected

- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/research/DEPENDENCY_FAILURE_ROUTE_PREPARED_RESOURCE_REGRESSION_AUDIT_2026_05_18.md`
- `docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_DEPENDENCY_FAILURE_ROUTE_REGRESSION_AUDIT_2026_05_18.md`
- `packages/webgpu/src/webgpu/queued-material-frame-resource-set.ts`
- `packages/webgpu/src/webgpu/queued-built-in-frame-resource-set.ts`
- `packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`
- `test/webgpu/queued-material-frame-resource-set.test.ts`
- `test/webgpu/queued-built-in-frame-resource-set.test.ts`

## Candidate Comparison

### Route / Prepared-Resource Candidate

Add a mixed built-in frame-resource regression for
`prepareQueuedBuiltInFrameResourceSet`.

Why now:

- The generic helper already has non-built-in and dependency-failure coverage.
- The built-in wrapper is the production app path that adapts unlit, matcap, and
  standard resources into the generic collector.
- Existing built-in wrapper coverage primarily proves a single unlit route and
  reset behavior. It does not pin that mixed built-in families all flow through
  the same generic pipeline planning, mesh/material resource maps, bind group
  scoping, and family bucket summaries.

Expected scope:

- `test/webgpu/queued-built-in-frame-resource-set.test.ts`.
- No source asset, ECS component, render snapshot, shader, WebGPU upload, or
  app facade behavior change unless the regression exposes a small bug.

### StandardMaterial / glTF Fidelity Candidate

Add the next browser diagnostic for a malformed or unsupported glTF material
field, such as alpha/double-sided behavior or UV-set metadata.

Why defer:

- The recent run already added several negative glTF diagnostics: invalid
  sampler indices, invalid sampler enum values, unsupported required and
  optional extensions, invalid scalar factors, invalid texture scalar fields,
  and invalid vector/color factors.
- The medium-term steering says the main risk is the specialized material route
  becoming permanent architecture. More glTF diagnostics are useful, but the
  route spine should get one more production-wrapper regression first.

### Diagnostics / Tooling Candidate

Add another public tracker or route-summary diagnostic-code aggregation check.

Why defer:

- The public tracker was just aligned after the dependency-failure route
  regression.
- Route-summary grouping and diagnostic-code sorting have already been pinned.
- The next diagnostic/tooling task should follow a new implementation slice so
  it reflects concrete status rather than restating the same route condition.

## Selected Follow-Up

Select the route/prepared-resource candidate.

### task-1338 Selection

Category: `webgpu-render`

Package/write-scope: `test/webgpu/queued-built-in-frame-resource-set.test.ts`;
implementation files only if the regression exposes a focused defect.

Reference anchor:
`packages/webgpu/src/webgpu/queued-built-in-frame-resource-set.ts`,
`packages/webgpu/src/webgpu/queued-material-frame-resource-set.ts`,
`test/webgpu/queued-material-frame-resource-set.test.ts`, and the local
WebGPU route/pipeline patterns in `references/engine` and `references/three.js`
for pipeline/resource grouping concepts.

Acceptance criteria:

- A single regression prepares at least two built-in material families through
  `prepareQueuedBuiltInFrameResourceSet`.
- It proves pipeline plan results are grouped by unique pipeline key while each
  routed item appends frame resources.
- It proves `byFamilySummary`, family-specific buckets, mesh resource keys,
  material resource keys, and pipeline-scoped bind group keys are deterministic.
- JSON serialization of the result omits raw GPU handles and source asset
  payloads.
- Validation runs the targeted built-in frame-resource test.

## Recommendation

Audit this plan next, then implement the mixed built-in frame-resource
regression if the audit confirms the scope.
