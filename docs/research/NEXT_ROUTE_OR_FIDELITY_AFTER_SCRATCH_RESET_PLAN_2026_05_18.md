# Next Route Or Fidelity Slice After Scratch Reset Plan

Date: 2026-05-18

## Scope

Plan the next narrow route or StandardMaterial/glTF fidelity slice after the
reusable route scratch reset regression.

This is a planning slice. It does not implement new route behavior, shader
features, IBL, shadows, binary GLB loading, GLB viewer behavior, or broad
material-family migration.

## References Inspected

- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/ARCHITECTURE.md`
- `docs/research/REUSABLE_ROUTE_SCRATCH_RESET_REGRESSION_AUDIT_2026_05_18.md`
- `docs/research/STANDARD_MATERIAL_FORMAT_COLOR_SPACE_BROWSER_FIXTURE_AUDIT_2026_05_18.md`
- `docs/research/NEXT_MATERIAL_ROUTE_OR_PBR_FIDELITY_SLICE_PLAN_2026_05_18.md`
- `docs/research/GENERIC_ROUTE_PREPARED_RESOURCE_PRESSURE_AUDIT_2026_05_18.md`
- `packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`
- `packages/webgpu/src/webgpu/queued-material-frame-resource-set-summary.ts`
- `packages/webgpu/src/webgpu/queued-material-route-summary-group.ts`
- `test/webgpu/queued-material-route-summary-group.test.ts`

## Candidates Compared

### Generic Route Summary Stale-State Regression

The reusable route scratch reset regression now proves the built-in app resource
collector resets route scratch between an unsupported collection and a valid
collection. The adjacent summary helpers are still deliberately allocation
friendly and JSON-safe, but they are the next diagnostic boundary that agents
and examples rely on when route failures occur.

A focused regression should prove a clean route summary does not retain stale
status or diagnostic buckets after a prior failed route summary. This keeps the
route cleanup work generic and does not require a new material family or app
route.

### StandardMaterial/glTF Fidelity Diagnostic

The StandardMaterial texture format/color-space diagnostic now has source,
summary, and browser/status coverage. Another glTF fidelity diagnostic is
reasonable soon, but starting one immediately would continue expanding
StandardMaterial-specific expectations while the generic route summary boundary
still has an obvious small cleanup test.

Good future candidates include stricter source-side diagnostics for unsupported
glTF material extensions or additional sampler/texture compatibility, as long
as they do not require IBL, shadows, binary GLB loading, or GLB viewer behavior.

## Selected Slice

Proceed with a generic route summary stale-state regression.

This is the better next slice because it strengthens the material route
architecture spine without changing public app behavior, shader features, or
source material semantics. It also gives the next StandardMaterial/glTF
diagnostic slice a cleaner generic diagnostics boundary to report through.

## Follow-Up Task

### task-1238 - Add generic route summary stale-state regression

Category: `webgpu-render`
Package/write-scope: targeted route summary tests under `test/webgpu`, plus a
tiny implementation fix only if the regression exposes stale state.
Reference anchor:
`docs/research/NEXT_ROUTE_OR_FIDELITY_AFTER_SCRATCH_RESET_PLAN_2026_05_18.md`,
`packages/webgpu/src/webgpu/queued-material-frame-resource-set-summary.ts`,
`packages/webgpu/src/webgpu/queued-material-route-summary-group.ts`, and
`packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`.

Acceptance criteria:

- Reuse summary inputs or route-report shells across a diagnostic-producing
  route result and a clean valid result.
- Assert the clean result does not serialize stale unsupported-family,
  dependency-failure, skipped, route-report, or diagnostic-code buckets.
- Preserve JSON-safe diagnostics and the existing generic route summary shape.
- Do not add new material families, app route structure, IBL, shadows, binary
  GLB loading, GLB viewer behavior, or shader behavior.

## Deferred Alternatives

- Real material-family app route migration remains larger than one focused
  cleanup test.
- Another StandardMaterial/glTF diagnostic should follow after route summary
  stale-state behavior is pinned or explicitly deprioritized.
- IBL, shadows, binary GLB loading, and GLB viewer behavior remain deferred.
