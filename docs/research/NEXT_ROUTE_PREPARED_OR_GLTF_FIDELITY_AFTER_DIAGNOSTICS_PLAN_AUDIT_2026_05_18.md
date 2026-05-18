# Next Route, Prepared-Resource, Or glTF Fidelity After Diagnostics Plan Audit

Date: 2026-05-18

## Scope

Audit the `task-1262` plan that selected invalid-source no-prepared-resource
browser status coverage.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/NEXT_ROUTE_PREPARED_OR_GLTF_FIDELITY_AFTER_DIAGNOSTICS_PLAN_2026_05_18.md`
- `docs/research/INVALID_GLTF_TEXTURE_INFO_BROWSER_DIAGNOSTIC_AUDIT_2026_05_18.md`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`

## Findings

Pass. The selected follow-up is concrete enough for one focused run and should
preserve ownership boundaries.

The implementation should only strengthen an existing invalid-source browser
assertion. It should read resource counts already published by the WebGPU app
render report and prove they stay at zero when source mapping prevents material
registration. That remains derived renderer/app status, not ECS or source asset
ownership.

Boundary checks:

- ECS remains authoritative; no component or source asset schema needs to
  change.
- Render extraction remains the no-draw boundary through the existing missing
  material handle diagnostic.
- WebGPU resources remain backend-owned; the test should assert their absence
  rather than expose handles.
- JSON status should stay free of raw GPU handles, backend resource objects,
  texture bytes, and sampler objects.

## Recommendation

Implement `task-1264` next.

Keep deferred:

- app-level non-built-in material adapter route migration;
- prepared-resource cache/lifetime implementation changes;
- shader behavior changes;
- WebGPU upload changes;
- IBL and shadows;
- binary GLB loading and GLB viewer behavior.

## Validation

Documentation-only audit. Validate with touched-file formatting and final
`git diff --check`.
