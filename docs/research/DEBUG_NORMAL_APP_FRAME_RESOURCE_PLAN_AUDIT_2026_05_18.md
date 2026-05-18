# DebugNormal App Frame Resource Plan Audit

Date: 2026-05-18

## Scope

Audit the selected DebugNormalMaterial app frame-resource cache/reuse plan.

## References Inspected

- `docs/research/NEXT_DEBUG_NORMAL_ROUTE_ACTIVATION_AFTER_FRAME_RESOURCES_PLAN_2026_05_18.md`
- `docs/research/DEBUG_NORMAL_FRAME_RESOURCE_AUDIT_2026_05_18.md`
- `docs/ARCHITECTURE.md`
- `packages/webgpu/src/webgpu/debug-normal-frame-resources.ts`
- `packages/webgpu/src/webgpu/unlit-app-frame-resources.ts`
- `packages/webgpu/src/webgpu/matcap-app-frame-resources.ts`
- `packages/webgpu/src/webgpu/app-frame-resource-utils.ts`
- `packages/webgpu/src/webgpu/prepared-app-mesh-resource.ts`

## Findings

- The selected follow-up is concrete enough for one focused run. It adds one
  app helper and targeted tests without activating route wiring.
- The helper preserves ECS authority because it consumes mesh/material handles,
  extracted snapshot data, and renderer caches; it does not mutate source ECS
  state.
- The helper preserves the render boundary by wrapping renderer-owned GPU
  resource creation and dynamic buffer writes.
- Same-key frame cache reuse is the right first app-level prerequisite. A
  broader DebugNormal prepared material cache can remain a later optimization if
  route integration shows a need for cross-cache-slot reuse.
- Active app routing and browser pixels should remain deferred until this helper
  exists.

## Recommendation

Implement `task-1396` as planned if there is enough runway for focused tests and
validation.
