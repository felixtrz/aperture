# Next Route Prepared Or glTF Fidelity After Vector Diagnostic Plan Audit

Date: 2026-05-18

## Scope

Audit the plan that selected a generic material-family frame-resource adapter
readiness check as the next route/prepared-resource follow-up.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/NEXT_ROUTE_PREPARED_OR_GLTF_FIDELITY_AFTER_VECTOR_DIAGNOSTIC_PLAN_2026_05_18.md`
- `docs/research/APP_LEVEL_GENERIC_MATERIAL_ADAPTER_ROUTE_BOUNDARY_PLAN_2026_05_18.md`
- `docs/research/GENERIC_MATERIAL_FAMILY_FRAME_RESOURCE_ADAPTER_INTERFACE_PLAN_2026_05_18.md`
- `packages/webgpu/src/webgpu/queued-material-frame-resource-set.ts`
- `test/webgpu/queued-material-frame-resource-set.test.ts`
- `test/webgpu/queued-material-app-resource-item.test.ts`

## Findings

Pass. The selected follow-up is a bounded audit/refactor task and is the right
next step before starting another app-level route migration.

The existing generic route item, adapter registry, frame-resource collector, and
test-only custom family coverage show that the architecture is close to a real
material-family adapter boundary. The next implementation slice still needs a
clear readiness check because it could touch app-owned WebGPU callbacks,
adapter-owned resource creation, route diagnostics, JSON-safe summaries, and
hot-path scratch reuse.

Boundary checks:

- ECS remains authoritative; the audit does not introduce source assets,
  components, or rendering behavior.
- Render extraction and snapshots remain derived data.
- WebGPU resources remain backend-owned and should stay behind adapter/resource
  preparation contracts.
- App-level non-built-in material rendering, binary GLB loading, IBL, shadows,
  GLB viewer behavior, and rendered material changes remain deferred.

## Recommendation

Implement `task-1332` next as a focused readiness audit. It should recommend the
smallest implementation slice, not start the migration itself.

## Validation

- Documentation-only audit; covered by final formatting and diff checks.
