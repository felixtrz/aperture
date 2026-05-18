# DebugNormal Route Readiness Map Audit

Date: 2026-05-18

## Scope

Audit the `task-1378` DebugNormalMaterial route-readiness map.

## References Inspected

- `docs/research/NEXT_ROUTE_PREPARED_AFTER_INVALID_PIPELINE_VIEW_PLAN_2026_05_18.md`
- `docs/research/DEBUG_NORMAL_ROUTE_READINESS_PLAN_AUDIT_2026_05_18.md`
- `docs/research/DEBUG_NORMAL_MATERIAL_ROUTE_READINESS_2026_05_18.md`
- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `packages/render/src/materials/debug-normal-preparation.ts`
- `packages/webgpu/src/webgpu/debug-normal-pipeline-descriptor.ts`
- `packages/webgpu/src/webgpu/debug-normal-shader.ts`
- `test/webgpu/built-in-material-queue-family.test.ts`
- `test/webgpu/built-in-material-queue-adapter.test.ts`

## Findings

Pass. The readiness map satisfies the selected acceptance criteria.

What is now documented:

- DebugNormalMaterial source asset type/factory status;
- renderer-independent preparation-plan status;
- WGSL shader metadata and pipeline descriptor planning status;
- why built-in app routing still excludes `debug-normal`;
- the missing renderer-owned material buffer, bind group, frame-resource,
  adapter, diagnostics, and browser pixel coverage pieces;
- a safe activation sequence that keeps routing deferred until frame resources
  can be prepared and tested.

Boundary checks:

- No ECS component, source asset schema, render extraction contract, WebGPU
  resource, route adapter, shader behavior, or public API changed.
- The map explicitly avoids storing GPU resources on ECS/source material data.
- The map does not claim app-level DebugNormalMaterial rendering, IBL, shadows,
  GLB viewer behavior, or broad custom shader support.

## Recommendation

Run tracker/backlog alignment next. The next implementation group should start
with a debug-normal material buffer resource helper and tests, while keeping app
routing inactive.

## Validation

Documentation-only audit; cover with formatting and final diff checks.
