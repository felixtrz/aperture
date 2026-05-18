# Pipeline Layout Missing Frame Resource Regression Audit

Date: 2026-05-18

## Scope

Audit the `task-1368` generic frame-resource-set regression for a valid
pipeline resource that lacks `getBindGroupLayout`.

## References Inspected

- `docs/research/NEXT_ROUTE_OR_GLTF_FIDELITY_AFTER_ALPHA_BLEND_DOUBLE_SIDED_PLAN_2026_05_18.md`
- `docs/research/PIPELINE_LAYOUT_MISSING_FRAME_RESOURCE_PLAN_AUDIT_2026_05_18.md`
- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `packages/webgpu/src/webgpu/queued-material-frame-resource-set.ts`
- `test/webgpu/queued-material-frame-resource-set.test.ts`

## Findings

Pass. The regression satisfies the selected acceptance criteria.

What is now pinned:

- `prepareQueuedMaterialFrameResourceSet()` rejects a valid pipeline resource
  when the pipeline object lacks `getBindGroupLayout`;
- the result is invalid and reports `webGpuApp.missingPipelineLayouts`;
- no frame resources are created or appended after the missing-layout failure;
- no mesh resources, bind groups, mesh resource-key mappings, or material
  resource-key mappings are produced;
- the failure result remains JSON-safe and does not expose raw GPU handles.

Boundary checks:

- No ECS component, source material asset, render extraction, app facade, shader,
  WebGPU upload, or public API shape changed.
- The regression stays on the generic renderer-owned frame-resource route
  helper and does not activate app-level non-built-in material rendering.
- The failure is a prepared-resource readiness guard, not a fallback path or
  hidden renderer-owned gameplay state.

## Recommendation

Run tracker/backlog alignment next. The next planning slice can continue route
contract work, with DebugNormal app activation or a narrowly scoped generic
route adapter step as candidates.

## Validation

- `pnpm exec vitest run test/webgpu/queued-material-frame-resource-set.test.ts`
