# DebugNormal Frame Resource Plan Audit

Date: 2026-05-18

## Scope

Audit the selected DebugNormalMaterial frame-resource helper plan before
implementation.

## References Inspected

- `docs/research/NEXT_DEBUG_NORMAL_ROUTE_ACTIVATION_AFTER_BIND_GROUP_PLAN_2026_05_18.md`
- `docs/research/DEBUG_NORMAL_MATERIAL_ROUTE_READINESS_2026_05_18.md`
- `docs/ARCHITECTURE.md`
- `packages/webgpu/src/webgpu/matcap-frame-resources.ts`
- `packages/webgpu/src/webgpu/unlit-frame-resources.ts`
- `packages/webgpu/src/webgpu/debug-normal-bind-group.ts`
- `references/three.js/src/renderers/common/Bindings.js`
- `references/engine/src/scene/frame-graph.js`

## Findings

- The selected follow-up is concrete enough for one focused run: it only adds a
  lower-level WebGPU helper and targeted tests.
- The helper preserves ECS authority because it consumes extracted mesh,
  material, view, and transform data; it does not own ECS/game state.
- The helper preserves the render extraction boundary because it assembles
  renderer-owned GPU resources from snapshot/prepared-resource inputs.
- The helper keeps diagnostics JSON-safe by returning diagnostic objects and
  resource metadata rather than raw GPU handles through public inspection.
- App-level routing remains correctly deferred until an app cache/reuse wrapper
  and route adapter exist.

## Recommendation

Implement `task-1391` as planned.
