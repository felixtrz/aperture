# App Diagnostics Summary Grouping Plan - 2026-05-17

## Scope

Plan a JSON-safe app diagnostics grouping helper that can compose the current
material/queue summary helpers without changing app render reports.

This is a planning slice only. It does not add `WebGpuAppRenderReport` fields,
change `WebGpuAppResourceReuseReport`, emit successful route reports, or alter
rendering behavior.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/research/MATERIAL_QUEUE_PHASE_SUMMARY_PLAN_2026_05_17.md`
- `docs/research/RENDER_FRAME_QUEUE_DIAGNOSTICS_PLACEMENT_PLAN_2026_05_17.md`
- `docs/research/QUEUED_BUILT_IN_RESOURCE_SET_SUMMARY_PLAN_2026_05_17.md`
- `packages/render/src/rendering/material-queue.ts`
- `packages/webgpu/src/webgpu/render-frame-plan.ts`
- `packages/webgpu/src/webgpu/queued-built-in-resource-set-summary.ts`
- `packages/webgpu/src/webgpu/app.ts`
- `test/webgpu/webgpu-app.test.ts`

## Existing Summary Surfaces

`MaterialQueuePhaseSummary` is renderer-independent. It describes material
queue items by render phase and material family before WebGPU app routing.

`QueuedBuiltInResourceSetSummary` is WebGPU-app-specific current-frame route
inspection. It describes routed built-in items by material family and pipeline
key before frame resources are prepared.

`RenderFrameQueueDiagnosticsSummary` is WebGPU frame-planning inspection. It
describes render-world draw readiness, draw package counts, package scratch
reuse, missing packed transforms, and queue-stage diagnostic code counts.

These three summaries describe adjacent current-frame stages. None of them is a
retained backend cache report.

## Placement Recommendation

Add a small composition helper in `packages/webgpu/src/webgpu`, exported through
the WebGPU package barrel.

Do not place this grouping inside `WebGpuAppResourceReuseReport`. Resource reuse
continues to describe retained backend/cache state. The composed diagnostics
group describes current-frame route and queue inspection data.

Do not wire the grouping into `WebGpuAppRenderReportJsonValue` yet. Keep the
first slice as a helper plus tests so a future app-report integration can be
driven by a concrete diagnostics consumer.

## Proposed Helper Shape

```ts
export interface WebGpuAppDiagnosticsSummaryInput {
  readonly materialQueue?: MaterialQueuePhaseSummary;
  readonly routedResourceSet?: QueuedBuiltInResourceSetSummary;
  readonly renderFrameQueue?: RenderFrameQueueDiagnosticsSummary;
}

export interface WebGpuAppDiagnosticsSummary {
  readonly sectionCount: number;
  readonly materialQueue?: MaterialQueuePhaseSummary;
  readonly routedResourceSet?: QueuedBuiltInResourceSetSummary;
  readonly renderFrameQueue?: RenderFrameQueueDiagnosticsSummary;
}

export function createWebGpuAppDiagnosticsSummary(
  input: WebGpuAppDiagnosticsSummaryInput,
): WebGpuAppDiagnosticsSummary;
```

The helper should only include sections that are present in the input. It may
reuse the already JSON-safe summary references rather than cloning them.

`sectionCount` should count present sections and make empty/partial/full tests
straightforward without requiring app report wiring.

## JSON Safety

The composed summary must not include:

- `RenderSnapshot` payloads;
- ECS worlds/entities beyond existing scalar entity refs in nested diagnostics;
- source mesh/material assets;
- prepared resource records;
- material adapters;
- raw WebGPU handles;
- frame resources, command encoders, command buffers, or queues.

Tests should check JSON stringification for empty, partial, and full inputs and
assert obvious payload/handle strings are absent.

## Relationship to App Reports

Future app report wiring, if needed, should add a distinct diagnostics field,
for example:

```ts
readonly diagnosticsSummary?: WebGpuAppDiagnosticsSummary;
```

That field should remain a sibling of `resourceReuse`, not a child. This keeps
current-frame route/queue inspection separate from retained backend cache
metrics.

## Focused Validation

Add tests covering:

- empty grouping with `sectionCount: 0`;
- partial grouping with only material queue or render-frame queue data;
- full grouping with all three sections;
- JSON stringification without source asset or WebGPU handle strings.

Suggested commands:

- `pnpm exec vitest run test/webgpu/app-diagnostics-summary.test.ts`
- `pnpm exec tsc --noEmit -p packages/webgpu/tsconfig.json`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`

## Non-Goals

- No `WebGpuAppRenderReport` or `WebGpuAppRenderReportJsonValue` changes.
- No `WebGpuAppResourceReuseReport` changes.
- No app-level successful route report emission.
- No retained cache summary changes.
- No renderer or WebGPU frame behavior changes.

## Recommended Implementation Slice

Proceed with `task-0940`:

- add an exported helper module for the app diagnostics grouping;
- compose optional existing summaries without widening their payloads;
- test empty, partial, and full inputs directly;
- leave app report wiring out of scope.
