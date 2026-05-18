# Material Route Migration Readiness After Route Determinism Audit

Date: 2026-05-18

## Scope

Audit whether deterministic queued material route summary coverage is sufficient
to start app-level non-built-in material route migration.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/ROUTE_MIGRATION_READINESS_OR_GLTF_FIDELITY_AFTER_ROUTE_DETERMINISM_PLAN_2026_05_18.md`
- `docs/research/ROUTE_MIGRATION_READINESS_OR_GLTF_FIDELITY_AFTER_ROUTE_DETERMINISM_PLAN_AUDIT_2026_05_18.md`
- `docs/research/ROUTE_SUMMARY_DIAGNOSTIC_CODE_SORTING_REGRESSION_AUDIT_2026_05_18.md`
- `docs/research/MATERIAL_ROUTE_MIGRATION_READINESS_AFTER_DIAGNOSTICS_AUDIT_2026_05_18.md`
- `docs/research/NEXT_FAMILY_ROUTE_READINESS_AUDIT_2026_05_18.md`
- `docs/research/GENERIC_MATERIAL_FAMILY_APP_ROUTE_SUMMARY_MIGRATION_PLAN_2026_05_18.md`
- `packages/render/src/materials/types.ts`
- `packages/render/src/rendering/material-queue.ts`
- `packages/webgpu/src/webgpu/queued-material-prepare-route.ts`
- `packages/webgpu/src/webgpu/queued-material-frame-resource-route.ts`
- `packages/webgpu/src/webgpu/queued-material-route-summary-group.ts`
- `packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`
- `test/webgpu/queued-material-route-summary-group.test.ts`

## Covered Criteria

Recent route work covers useful readiness criteria:

- route prepare summaries omit raw facade resource keys and GPU handles;
- frame-resource route summaries omit raw backend resource keys and GPU handles;
- grouped summaries aggregate prepare and frame-resource stages;
- grouped summaries separate valid and invalid counts by stage;
- grouped summaries aggregate diagnostic totals and code counts;
- reusable route/report shells reset after failed routes;
- clean route groups do not retain stale failed-family state;
- test-only non-built-in family strings can be summarized without public
  material-family API changes;
- mixed built-in, test-only, and failed routes aggregate deterministically;
- diagnostic-code maps sort deterministically and merge duplicate codes across
  prepare and frame-resource stages.

These are enough to trust the route-summary inspection surface. They are not
yet enough to add app-level non-built-in material rendering.

## Missing Criteria

App-level route migration still has structural blockers:

- `MaterialKind` is a closed union of `unlit`, `matcap`, `standard`, and
  `debug-normal`.
- `MaterialQueueFamily` currently aliases `MaterialKind`, so the queue contract
  is not yet open to registered material-family strings.
- `materialQueueFamilyFromPipelineKey()` rejects any pipeline family outside the
  closed built-in set before app routing can see it.
- `QueuedBuiltInAppResourceSet` and `QUEUED_BUILT_IN_MATERIAL_ADAPTERS` remain
  intentionally built-in-specific.
- The browser app diagnostics still assemble successful routed resource-set
  status through the built-in path, even though the summary helper underneath is
  now generic.
- A real non-built-in material family would need a source asset contract,
  pipeline-key contract, prepared-resource contract, shader/pipeline behavior,
  and browser diagnostics. None of those should be introduced as a side effect
  of a route-summary cleanup task.

## Recommendation

Do not start app-level non-built-in material routing yet.

Return to StandardMaterial/glTF fidelity work for the next implementation
planning slice, using `task-1285`. That keeps progress on the current proof
point while avoiding a premature public material-family extension story.

Before app-level non-built-in routing resumes, add or select a narrow
architecture task that decides how Aperture should represent material-family
extensibility across `MaterialKind`, `MaterialQueueFamily`, pipeline keys,
prepared-resource adapters, and app diagnostics. That task should be a plan or
audit first, not a broad implementation.

## Deferred

- App-level non-built-in material rendering.
- Public material-family plugin APIs.
- Arbitrary custom shader material support.
- IBL, shadows, binary GLB loading, and GLB viewer behavior.

## Validation

Documentation-only audit. Validate with touched-file formatting and final
`git diff --check`.
