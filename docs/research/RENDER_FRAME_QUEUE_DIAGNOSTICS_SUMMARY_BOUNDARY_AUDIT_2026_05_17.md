# Render Frame Queue Diagnostics Summary Boundary Audit - 2026-05-17

## Scope

Audit the `createRenderFrameQueueDiagnosticsSummary()` helper added after the
render-frame queue diagnostics placement plan.

This audit checks ownership and JSON shape only. It does not change frame
planning, app reports, WebGPU resource preparation, or command submission.

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/research/RENDER_FRAME_QUEUE_DIAGNOSTICS_PLACEMENT_PLAN_2026_05_17.md`
- `packages/webgpu/src/webgpu/render-frame-plan.ts`
- `test/webgpu/render-frame-plan.test.ts`
- `packages/webgpu/src/webgpu/app.ts`

## Findings

No corrective code changes are required.

`RenderFrameQueueDiagnosticsSummary` describes derived frame-planning state:

- draw-readiness ready and blocked counts;
- draw-package counts and package scratch reuse counts;
- missing packed-transform count;
- queue-stage diagnostic totals grouped by code.

The helper does not own or expose retained backend resources. It is not wired
into `WebGpuAppResourceReuseReport`, pipeline caches, mesh/material buffer
caches, bind group resources, texture/sampler caches, command encoders, or
submission reports.

The summary is JSON-safe and scalar-only. Tests cover empty render-world,
ready/reused-package, blocked-resource, and missing-transform queue states, and
verify the serialized helper result does not contain frame payload or GPU-like
handle strings.

The helper consumes existing plan outputs (`readiness` and `packages`) and
returns a new summary object. This keeps ECS/render state authoritative outside
the WebGPU backend and keeps the render world/draw packages as the source for
queue planning rather than adding a hidden scene graph or app-owned queue model.

## Boundary Notes

- The helper lives in `@aperture-engine/webgpu` because it summarizes a
  WebGPU frame-planning boundary.
- It depends on `RenderWorldDrawPackagePlan.summary`, which is produced by the
  renderer-independent draw-package planner. That dependency remains
  directional: WebGPU consumes render data, render does not import WebGPU.
- It does not include `RenderWorldDrawPackage` records, `MeshDrawPacket`
  payloads, snapshots, ECS world state, source assets, prepared resource
  records, pipelines, bind groups, buffers, or WebGPU handles.
- `ready` intentionally means the queue stage has no blocked draws and no
  queue-stage diagnostics. An empty render world remains not-ready because
  `RenderWorld` emits `renderWorld.empty` as a readiness diagnostic.

## Follow-Up

The queued built-in resource-set summary tasks already preserve the ownership
distinction this audit needs:

- current-frame queued resource summaries belong near app preparation helpers;
- retained backend cache/reuse summaries remain in `WebGpuAppResourceReuseReport`;
- successful route reports remain absent unless a concrete diagnostics consumer
  needs them.

No backlog wording changes are needed for this audit.

## Validation

- `pnpm exec vitest run test/webgpu/render-frame-plan.test.ts`
- `pnpm run build`
- `pnpm exec tsc --noEmit -p packages/webgpu/tsconfig.json`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm exec prettier --check packages/webgpu/src/webgpu/render-frame-plan.ts test/webgpu/render-frame-plan.test.ts`
