# Material Route Migration Readiness After Diagnostics Audit

Date: 2026-05-18

## Scope

Re-evaluate material route migration readiness after the glTF diagnostic and
no-prepared-resource browser coverage added in this run.

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/ARCHITECTURE.md`
- `docs/research/MATERIAL_FAMILY_ROUTE_MIGRATION_CRITERIA_AUDIT_2026_05_18.md`
- `docs/research/INVALID_SOURCE_NO_PREPARED_RESOURCE_BROWSER_SUMMARY_AUDIT_2026_05_18.md`
- `docs/research/INVALID_GLTF_TEXTURE_INFO_BROWSER_DIAGNOSTIC_AUDIT_2026_05_18.md`
- `docs/research/UNRESOLVED_GLTF_TEXTURE_BINDING_BROWSER_DIAGNOSTIC_AUDIT_2026_05_18.md`
- `packages/webgpu/src/webgpu/queued-material-frame-resource-route.ts`
- `packages/webgpu/src/webgpu/queued-material-route-summary-group.ts`

## Findings

The project is closer to returning to material route migration, but a broad
app-level non-built-in material-family route is still larger than the next
single slice should attempt.

What improved this run:

- route summary groups now prove clean-after-failed behavior;
- invalid glTF render-state, unresolved texture-binding, and invalid
  texture-info cases all propagate through browser status;
- invalid source mapping now proves no prepared resources, pipelines, or draws
  are created for at least one expected-failure fixture.

The smallest next route migration criterion should stay observable and
diagnostic-first: prove route/prepared-resource summaries can report a
non-built-in family adapter in a test-only path without requiring the app facade
to render that family. That can build on the previous test-only adapter spike
and the route summary group hygiene work, while still avoiding a new public
material family or shader path.

## Recommended Next Criterion

Plan a test-only non-built-in material adapter route summary fixture before
implementation.

The implementation candidate should remain narrow:

- test-only adapter and material asset;
- route/prepare/frame-resource summaries only;
- JSON-safe status or unit summary assertions;
- no app-level non-built-in draw submission;
- no shader, WebGPU upload, IBL, shadow, binary GLB, or GLB viewer behavior.

## Backlog Adjustment

Update the ready backlog to start with a planning task for the test-only
non-built-in material adapter route summary fixture, followed by an audit and a
small implementation candidate.

## Validation

Documentation-only audit. Validate with touched-file formatting and final
`git diff --check`.
