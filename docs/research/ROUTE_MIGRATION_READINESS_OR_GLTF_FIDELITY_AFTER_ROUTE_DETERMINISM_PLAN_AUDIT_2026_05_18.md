# Route Migration Readiness Or glTF Fidelity After Route Determinism Plan Audit

Date: 2026-05-18

## Scope

Audit the `task-1282` plan that selected a material route migration readiness
audit after deterministic route summary coverage.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/ROUTE_MIGRATION_READINESS_OR_GLTF_FIDELITY_AFTER_ROUTE_DETERMINISM_PLAN_2026_05_18.md`
- `docs/research/ROUTE_SUMMARY_DIAGNOSTIC_CODE_SORTING_REGRESSION_AUDIT_2026_05_18.md`
- `docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_ROUTE_SUMMARY_SORTING_AUDIT_2026_05_18.md`
- `packages/webgpu/src/webgpu/queued-material-route-summary-group.ts`
- `packages/webgpu/src/webgpu/queued-material-frame-resource-route.ts`
- `packages/webgpu/src/webgpu/queued-material-prepare-route.ts`
- `packages/render/src/materials/gltf-material.ts`
- `examples/standard-gltf-texture.js`

## Findings

Pass. The selected follow-up is concrete, bounded, and appropriate for the next
step.

The plan correctly avoids treating the recent route-summary regressions as proof
that app-level non-built-in material routing is ready. It instead asks for a
readiness audit that lists what is already covered and what still blocks a
narrow app migration slice. That keeps the next task inside the architecture
guardrails: ECS remains authoritative, render extraction remains the boundary,
and WebGPU resource ownership stays in the backend.

Boundary checks:

- no ECS authoring, render extraction, or render snapshot contract change is
  implied;
- no WebGPU upload, pipeline, shader, bind group, or draw submission change is
  needed for the audit;
- JSON-safe diagnostics remain the inspection surface;
- app-level non-built-in material rendering, IBL, shadows, binary GLB loading,
  and GLB viewer behavior remain deferred;
- no public material-family API is added by the plan.

## Recommendation

Implement `task-1284` next.

The audit should recommend one of two outcomes:

- a concrete app-level migration slice if the missing criteria are small and
  testable; or
- a return to StandardMaterial/glTF fidelity diagnostics if route migration
  still needs more readiness work.

Do not start app-level non-built-in rendering as part of the audit.

## Validation

Documentation-only audit. Validate with touched-file formatting and final
`git diff --check`.
