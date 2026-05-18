# StandardMaterial Route Compatibility Test Audit

Date: 2026-05-18

## Scope

Audit the StandardMaterial route compatibility test added in `task-1195`.

## References Inspected

- `docs/research/STANDARD_MATERIAL_ROUTE_CLEANUP_AFTER_GENERIC_BOUNDARY_PLAN_2026_05_18.md`
- `test/webgpu/queued-built-in-app-resource-set.test.ts`
- `packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`
- `packages/webgpu/src/webgpu/queued-material-app-resource-item.ts`
- `docs/ARCHITECTURE.md`

## Findings

The test is scoped correctly:

- It checks StandardMaterial route identity across queue item, prepare route,
  adapter kind, source keys, and prepared mesh/material resource keys.
- It asserts no `standardResourceSet` diagnostics field is introduced.
- It does not modify StandardMaterial WGSL, PBR texture behavior, GLB mapping,
  lighting, shadows, browser examples, or app runtime behavior.

The test preserves current app diagnostics compatibility:

- App diagnostics continue to use `routedResourceSet`.
- Built-in compatibility arrays are not promoted as a pattern for future
  families.
- No raw GPU handle strings are expected in serialized results.

## Recommendation

The route cleanup spine is pinned enough to plan the next StandardMaterial PBR
fidelity slice. That plan should remain narrow, should include diagnostics, and
should not jump to IBL or shadows before texture/material contracts are stable.

## Outcome

No corrective code change was needed. Proceed to planning the next
StandardMaterial fidelity slice.
