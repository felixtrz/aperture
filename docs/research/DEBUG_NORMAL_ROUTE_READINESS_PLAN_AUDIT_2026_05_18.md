# DebugNormal Route Readiness Plan Audit

Date: 2026-05-18

## Scope

Audit the `task-1376` plan to add a DebugNormalMaterial app route activation
readiness map.

## References Inspected

- `docs/research/NEXT_ROUTE_PREPARED_AFTER_INVALID_PIPELINE_VIEW_PLAN_2026_05_18.md`
- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/DECISIONS.md`
- `packages/render/src/materials/debug-normal-preparation.ts`
- `packages/webgpu/src/webgpu/debug-normal-pipeline-descriptor.ts`
- `packages/webgpu/src/webgpu/debug-normal-shader.ts`
- `test/webgpu/built-in-material-queue-family.test.ts`
- `test/webgpu/built-in-material-queue-adapter.test.ts`

## Findings

Pass. The selected follow-up is concrete enough for one focused run and avoids
turning DebugNormalMaterial shader metadata into premature app-level rendering.

Boundary checks:

- The readiness map is docs/tooling only and does not change ECS components,
  source asset schemas, extraction, WebGPU resource creation, or app routing.
- It preserves the current fact that DebugNormalMaterial source/preparation and
  shader/pipeline descriptor pieces exist while active built-in app routing is
  still scoped to unlit, matcap, and standard materials.
- It can define the activation sequence without adding a hidden scene graph,
  WebGL fallback, or renderer-owned gameplay state.

## Recommendation

Implement `task-1378` as planned by adding a focused readiness map under
`docs/research`. Keep actual DebugNormalMaterial app rendering deferred until a
later implementation task explicitly adds the missing material buffer, bind
group, route adapter, frame-resource, and browser coverage pieces.

## Validation

Documentation-only audit; cover with formatting and final diff checks.
