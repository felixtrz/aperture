# App Frame Resource Extraction Sequence Audit - 2026-05-17

## Scope

Audit the full app frame-resource extraction sequence from this run.

This audit covers:

- route adapter factory extraction;
- app texture/sampler resource helper extraction;
- app resource adapter construction shell;
- unlit, Matcap, and Standard app frame-resource helper extraction;
- shared app frame-resource utility extraction.

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/research/APP_LOCAL_RESOURCE_ADAPTER_SPLIT_PLAN_2026_05_17.md`
- `docs/research/APP_TEXTURE_SAMPLER_RESOURCE_BOUNDARY_AUDIT_2026_05_17.md`
- `docs/research/UNLIT_APP_FRAME_RESOURCE_BOUNDARY_AUDIT_2026_05_17.md`
- `docs/research/STANDARD_APP_FRAME_RESOURCE_BOUNDARY_AUDIT_2026_05_17.md`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/app-texture-sampler-resources.ts`
- `packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts`
- `packages/webgpu/src/webgpu/unlit-app-frame-resources.ts`
- `packages/webgpu/src/webgpu/matcap-app-frame-resources.ts`
- `packages/webgpu/src/webgpu/standard-app-frame-resources.ts`
- `packages/webgpu/src/webgpu/app-frame-resource-utils.ts`
- `references/three.js/src/renderers/webgl/WebGLRenderLists.js`
- `references/engine/src/scene/layer.js`

## Findings

No ECS/render/WebGPU ownership drift was found.

The extracted modules preserve the intended ownership boundaries:

- ECS and render snapshots remain source-of-truth inputs.
- WebGPU resources remain backend-owned.
- Route adapters own family/type/phase routing only.
- Texture/sampler helpers own source asset to WebGPU texture/sampler
  preparation only.
- Frame-resource helpers own per-family app frame-resource create/reuse behavior
  only.
- `app.ts` still owns app lifecycle, WebGPU initialization, cache construction,
  route diagnostics, pipeline selection, layout lookup, render frame planning,
  and command submission.

The current broad app tests already cover second-frame reuse counters for unlit,
Matcap, mixed built-in, and StandardMaterial paths, including dynamic buffer
write counts and Standard light buffer reuse. A smaller focused cache-slot test
may still be useful later if app test failures become too broad to diagnose.

## Remaining Risks

- The frame-resource helpers still allocate reused result wrappers and copy
  texture/sampler key arrays on cache miss. This is existing behavior and should
  be handled by a dedicated hot-path allocation cleanup.
- The app facade still contains the queued resource-set assembly loop and
  pipeline/layout selection. That is acceptable for now, but the next prepared
  asset/resource-cache work should keep moving toward render-world-owned
  prepared resources rather than growing the app facade.

## Validation

- `pnpm exec vitest run test/webgpu/webgpu-app.test.ts`
- `pnpm exec vitest run test/webgpu/webgpu-app.test.ts test/webgpu/built-in-material-queue-adapter.test.ts test/webgpu/built-in-material-app-resource-adapter.test.ts`
- `pnpm exec tsc --noEmit -p packages/webgpu/tsconfig.json`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm run lint`
- `pnpm run format:check`
- `pnpm run check:boundaries`
- `pnpm run check`

## Follow-Ups

- Decide whether `task-0791` should add new cache-slot tests or be rewritten to
  document that existing app reuse tests cover the slot behavior sufficiently.
- Continue with hot-path allocation planning before changing reusable result
  shells.
- Plan the handoff from app-local frame resources toward renderer-owned
  prepared material resources.
