# Invalid Pipeline View Frame Resource Regression Audit

Date: 2026-05-18

## Scope

Audit the `task-1373` generic frame-resource-set regression for an invalid
pipeline view.

## References Inspected

- `docs/research/NEXT_ROUTE_PREPARED_AFTER_PIPELINE_LAYOUT_GUARD_PLAN_2026_05_18.md`
- `docs/research/INVALID_PIPELINE_VIEW_FRAME_RESOURCE_PLAN_AUDIT_2026_05_18.md`
- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `packages/webgpu/src/webgpu/queued-material-frame-resource-set.ts`
- `test/webgpu/queued-material-frame-resource-set.test.ts`

## Findings

Pass. The regression satisfies the selected acceptance criteria.

What is now pinned:

- `prepareQueuedMaterialFrameResourceSet()` preserves invalid pipeline-view
  diagnostics;
- invalid pipeline views prevent pipeline plan creation, layout lookup,
  dependency preparation, and frame-resource creation;
- no mesh resources, bind groups, mesh resource-key mappings, or material
  resource-key mappings are produced;
- the failure result remains JSON-safe and does not expose raw GPU handles.

Boundary checks:

- No ECS component, source asset, render extraction, app facade, shader, WebGPU
  upload path, or public API shape changed.
- The regression stays in the generic renderer-owned prepared-resource helper
  and does not activate app-level non-built-in material rendering.
- The test complements the missing-layout guard by pinning the earlier invalid
  pipeline-view branch.

## Recommendation

Run tracker/backlog alignment next. After that, the next route planning slice can
consider DebugNormalMaterial app activation readiness or continue hardening
generic route diagnostics.

## Validation

- `pnpm exec vitest run test/webgpu/queued-material-frame-resource-set.test.ts`
