# Next Material Route Or glTF Fidelity Slice Plan

Date: 2026-05-18

## Scope

Select the next narrow slice after the test-only non-built-in route summary
fixture and tracker/backlog alignment.

## References Inspected

- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/ARCHITECTURE.md`
- `docs/research/TEST_ONLY_NON_BUILT_IN_ROUTE_SUMMARY_FIXTURE_AUDIT_2026_05_18.md`
- `packages/webgpu/src/webgpu/queued-material-route-summary-group.ts`
- `packages/render/src/materials/gltf-material.ts`
- `examples/standard-gltf-texture.js`

## Candidates Compared

### Mixed-family route summary aggregation regression

Add a unit test that groups one built-in prepared route, one test-only
non-built-in prepared route, and one failed route. Assert aggregate totals,
valid/invalid counts, status counts, diagnostic code counts, and JSON-safe
output.

Why this is preferred:

- It extends the just-added non-built-in route summary fixture into a more
  realistic mixed-family aggregate without claiming app-level non-built-in draw
  support.
- It strengthens generic route diagnostics before broader route migration.
- It is small, deterministic, and testable in the existing route-summary test
  file.

### Narrow app-status route diagnostic

Expose another route summary detail through app/browser status.

Why this is deferred:

- App status currently represents built-in frame-resource buckets. Adding a
  non-built-in status scenario risks implying app-level adapter migration before
  the route/prepared-resource contract is explicit.

### StandardMaterial/glTF fidelity diagnostic

Add another source-side glTF material diagnostic fixture.

Why this is deferred for one more slice:

- The current run just landed several glTF diagnostic browser fixtures. The
  route-summary side now has a direct follow-up that exercises the generic
  aggregation surface without touching source material behavior.

## Selected Follow-Up

Select `task-1274 — Add mixed-family route summary aggregation regression`.

The slice should:

- build a grouped summary from a prepared built-in route, a prepared test-only
  non-built-in route, and a failed route;
- assert deterministic totals, prepared/failed status counts, and diagnostic
  code counts;
- assert JSON-safe output omits raw facade/backend resource keys and GPU
  handles;
- stay unit-level and avoid app-level non-built-in material rendering, shader
  behavior, WebGPU uploads, IBL, shadows, binary GLB loading, GLB viewer
  behavior, and public material-family API changes.

## Validation

Plan-only task. Validate with touched-file formatting and final
`git diff --check`.
