# WebGPU Material Queue Route Report Boundary Audit - 2026-05-17

## Scope

Audited the material queue route report helper, JSON projection, and diagnostic
aggregation from `task-0753` through `task-0755`.

Audited files:

- `packages/webgpu/src/webgpu/material-queue-route-report.ts`
- `packages/webgpu/src/webgpu/index.ts`
- `test/webgpu/material-queue-route-report.test.ts`
- `test/webgpu/material-queue-route-report-json.test.ts`
- `test/webgpu/material-queue-route-report-diagnostics.test.ts`
- `docs/research/WEBGPU_APP_MATERIAL_QUEUE_ROUTE_REPORT_PLAN_2026_05_17.md`

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `packages/render/src/rendering/material-queue.ts`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/queued-material-adapter.ts`
- `references/three.js/src/renderers/webgl/WebGLRenderLists.js`
- `references/engine/src/scene/layer.js`

## Findings

No boundary drift found.

`createWebGpuAppMaterialQueueRouteReport` is diagnostic metadata only. It
accepts compact queue item summaries, routed item summaries, and diagnostics,
then computes:

- Total queued/routed/skipped counts.
- Counts by material family.
- Counts by render phase.
- Diagnostic totals by severity and code.

The helper does not import or inspect `RenderSnapshot`, `MeshDrawPacket`,
`AssetRegistry`, `EcsWorld`, source material assets, prepared GPU resources,
WebGPU devices, pipelines, bind groups, command encoders, or browser APIs.

The JSON helper returns only scalar counts, family/phase strings, diagnostic
summaries, and copied diagnostic fields. It omits raw queue item arrays, adapter
objects, source assets, functions, GPU handles, pipeline handles, and bind-group
handles.

The helper is not wired into `app.ts`, so current WebGPU app queue routing
behavior is unchanged.

## Validation

- Ownership scan found no ECS, asset registry, render snapshot, render packet,
  GPU device, pipeline, bind-group, or command-encoder usage in the route report
  helper.
- `pnpm exec vitest run test/webgpu/material-queue-route-report.test.ts test/webgpu/material-queue-route-report-json.test.ts test/webgpu/material-queue-route-report-diagnostics.test.ts`
  passed.
- `pnpm exec tsc --noEmit -p tsconfig.test.json` passed.
- `pnpm run check:boundaries` passed during the final validation pass for this
  task group.

## Follow-Ups

No corrective refactor is needed.

The next work should plan the smallest extraction of built-in material adapter
routing from `app.ts`, using the adapter registry and route report helpers as
inspection surfaces while preserving unlit, matcap, and StandardMaterial
behavior.
