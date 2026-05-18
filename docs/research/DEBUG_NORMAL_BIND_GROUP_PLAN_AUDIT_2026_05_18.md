# DebugNormal Bind Group Plan Audit

Date: 2026-05-18

## Scope

Audit the `task-1384` plan to add DebugNormalMaterial group-2 bind group layout
and resource helpers.

## References Inspected

- `docs/research/NEXT_DEBUG_NORMAL_ROUTE_ACTIVATION_PLAN_2026_05_18.md`
- `docs/research/DEBUG_NORMAL_MATERIAL_ROUTE_READINESS_2026_05_18.md`
- `docs/research/DEBUG_NORMAL_MATERIAL_BUFFER_RESOURCE_AUDIT_2026_05_18.md`
- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `packages/webgpu/src/webgpu/debug-normal-material-buffer.ts`
- `packages/webgpu/src/webgpu/debug-normal-shader.ts`
- `packages/webgpu/src/webgpu/matcap-bind-group-layout.ts`
- `packages/webgpu/src/webgpu/matcap-bind-group.ts`
- `test/webgpu/matcap-bind-group.test.ts`
- `references/three.js/src/renderers/common/Bindings.js`

## Findings

Pass. The selected follow-up is concrete enough for one focused run and follows
the established renderer-owned material resource sequence.

Boundary checks:

- The slice consumes renderer-owned material buffer resources and does not
  modify ECS/source material data.
- Group-2 bind group resources are required before any debug-normal frame
  resources or app route adapter activation.
- JSON-safe inspection should omit raw bind group handles.
- App-level DebugNormalMaterial routing, frame resources, browser rendering,
  IBL, shadows, and GLB viewer behavior remain deferred.

## Recommendation

Implement `task-1386` as planned if the run still has enough time for the helper,
tests, and targeted validation. If not, leave it as the next task.

## Validation

Documentation-only audit; cover with formatting and final diff checks.
