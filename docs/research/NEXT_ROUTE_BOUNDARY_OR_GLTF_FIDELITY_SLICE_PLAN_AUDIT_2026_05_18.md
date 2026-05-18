# Next Route-Boundary Or glTF Fidelity Slice Plan Audit

Date: 2026-05-18

## Scope

Audit the `task-1307` plan that selected a grouped route-key diagnostics summary
regression as the next implementation slice.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/NEXT_ROUTE_BOUNDARY_OR_GLTF_FIDELITY_SLICE_PLAN_2026_05_18.md`
- `docs/research/UNREGISTERED_ROUTE_KEY_APP_DIAGNOSTIC_AUDIT_2026_05_18.md`
- `docs/research/OPTIONAL_GLTF_MATERIAL_EXTENSION_WARNING_STATUS_AUDIT_2026_05_18.md`
- `packages/webgpu/src/webgpu/material-queue-route-report.ts`

## Findings

Pass. The selected follow-up is concrete enough for one focused run and stays on
the correct side of the ECS/render/WebGPU boundary.

The route-key diagnostics summary regression is a good next step because it
hardens the newly documented route-family key contract without adding a custom
material source asset, adapter registry, shader, pipeline, or fallback renderer.
It should remain app/test-facing and assert only JSON-safe route report data:
the failed custom family, skipped counts, and diagnostic summary counts.

Boundary checks:

- ECS remains authoritative; the selected work should mutate only extracted
  route data inside a test fixture.
- Render extraction and route-report data remain derived diagnostics, not
  renderer-owned gameplay state.
- WebGPU remains the only backend, and the test must not add WebGL or fallback
  rendering behavior.
- App-level non-built-in material rendering remains deferred until a real source
  asset and prepared-resource adapter contract exist.

## Recommendation

Implement `task-1309` next. Keep the change narrow: extend the existing
unregistered route-family app diagnostic coverage to assert grouped summary JSON
instead of introducing new route APIs.

## Validation

- Documentation-only audit; covered by final formatting and diff checks.
