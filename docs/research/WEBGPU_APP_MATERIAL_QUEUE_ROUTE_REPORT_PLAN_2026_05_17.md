# WebGPU App Material Queue Route Report Plan - 2026-05-17

## Scope

Plan a JSON-safe report for WebGPU app material queue routing. The report should
make adapter selection and queue routing failures inspectable without changing
rendering behavior.

This is a planning slice only. It does not add a report implementation, change
shader code, move app routing, alter pipeline creation, or change draw
submission.

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/GENERIC_MATERIAL_FAMILY_QUEUE_CONTRACT_PLAN_2026_05_17.md`
- `docs/research/QUEUED_MATERIAL_ADAPTER_REGISTRY_BOUNDARY_AUDIT_2026_05_17.md`
- `packages/render/src/rendering/material-queue.ts`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/queued-material-adapter.ts`
- `test/webgpu/webgpu-app.test.ts`
- `test/webgpu/*-json.test.ts`
- `references/three.js/src/renderers/webgl/WebGLRenderLists.js`
- `references/engine/src/scene/layer.js`

## Current Route

The WebGPU app route currently:

1. Indexes prepared source mesh/material assets from a `RenderSnapshot`.
2. Builds sorted `MaterialQueueItem`s with `writeMaterialQueueFromSnapshot`.
3. Looks up a queued material adapter by `materialFamily`.
4. Emits `webGpuApp.unsupportedMaterialQueueFamily` for unknown families.
5. Emits phase/blend diagnostics from
   `createUnsupportedQueuedBuiltInPhaseDiagnostic`.
6. Checks source material kind against the adapter family and emits
   `webGpuApp.materialQueueAssetMismatch`.
7. Prepares texture/sampler dependencies.
8. Creates or reuses frame resources.
9. Appends resources into built-in family buckets for draw submission.

The diagnostics are useful, but there is no compact JSON-safe summary of the
route as a distinct stage.

## Proposed Report Shape

```ts
interface WebGpuAppMaterialQueueRouteReport {
  readonly valid: boolean;
  readonly queueItemCount: number;
  readonly routedItemCount: number;
  readonly skippedItemCount: number;
  readonly byFamily: readonly WebGpuAppMaterialQueueFamilyRouteSummary[];
  readonly byPhase: readonly WebGpuAppMaterialQueuePhaseRouteSummary[];
  readonly diagnostics: readonly WebGpuAppMaterialQueueRouteDiagnostic[];
}

interface WebGpuAppMaterialQueueFamilyRouteSummary {
  readonly family: string;
  readonly queuedCount: number;
  readonly routedCount: number;
  readonly skippedCount: number;
}

interface WebGpuAppMaterialQueuePhaseRouteSummary {
  readonly phase: string;
  readonly queuedCount: number;
  readonly routedCount: number;
  readonly skippedCount: number;
}
```

Initial diagnostic inputs should include existing route diagnostics:

- `webGpuApp.unsupportedMaterialQueueFamily`
- `webGpuApp.unsupportedMaterialQueuePhase`
- `webGpuApp.unsupportedMaterialQueueAlphaTestFamily`
- `webGpuApp.unsupportedMaterialQueueTransparentFamily`
- `webGpuApp.unsupportedMaterialQueueBlendPreset`
- `webGpuApp.materialQueueAssetMismatch`
- Texture/sampler dependency readiness diagnostics.
- Frame resource creation diagnostics.
- Adapter registry duplicate-family diagnostics as setup warnings.

The report should preserve render id, draw index, material family, render phase,
blend preset, material kind, and entity when those fields exist. It should omit
raw adapter objects, source assets, GPU buffers, bind groups, pipelines, command
encoders, and device/context handles.

## Hot-Path Allocation Guidance

The first implementation should be diagnostic/report-only and may allocate in
tests or failure/report projection helpers.

Before wiring the report into per-frame app rendering:

- Keep successful queue routing on existing scratch arrays and maps.
- Accumulate counts into a caller-owned report shell or scratch object.
- Allocate detailed diagnostic objects only on failure or explicit report
  projection.
- Keep JSON projection separate from the frame hot path.

## Non-Goals

This report should not:

- Change material queue sorting.
- Change which material families are supported.
- Prepare new GPU resources.
- Add IBL, shadows, or new StandardMaterial texture behavior.
- Move queue routing into ECS or render extraction.
- Create a public plugin system.
- Add WebGL fallback.

## Suggested Implementation Slices

1. Add JSON tests for existing app route diagnostics to lock current payloads.
2. Add a small route report builder that accepts queue items, routed item
   summaries, and diagnostics, then returns counts by family/phase.
3. Add JSON helpers for the route report.
4. Wire the report into app render diagnostics only when it can reuse existing
   route scratch and avoid success-path allocations.
5. Audit before extracting the built-in adapter route from `app.ts`.
