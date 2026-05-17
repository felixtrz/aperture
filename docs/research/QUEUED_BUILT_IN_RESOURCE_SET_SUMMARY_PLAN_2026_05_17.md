# Queued Built-In Resource Set Summary Plan - 2026-05-17

## Scope

Plan a JSON-safe summary helper for queued built-in app resource sets. This is a
planning slice only. It does not change route behavior, frame-resource
preparation, retained WebGPU caches, app reports, or command submission.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/research/QUEUED_MATERIAL_ROUTE_COLLECTOR_REUSE_BOUNDARY_AUDIT_2026_05_17.md`
- `docs/research/RENDER_FRAME_QUEUE_DIAGNOSTICS_SUMMARY_BOUNDARY_AUDIT_2026_05_17.md`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/reusable-route-collector.ts`
- `packages/render/src/rendering/material-queue.ts`
- `test/webgpu/reusable-route-collector.test.ts`
- `test/webgpu/webgpu-app.test.ts`

## Current Surface

`collectQueuedBuiltInAppResourceSet()` routes current-frame material queue items
into `QueuedBuiltInAppResourceItem` records. Each item carries:

- the renderer-independent `MaterialQueueItem`;
- the selected built-in material adapter;
- source draw, mesh, and material assets;
- prepared mesh/material resource keys.

The route collector now reuses arrays and returns a stable resource-set wrapper
for valid frames. Route report diagnostics are emitted only on failure.

`WebGpuAppResourceReuseReport` describes retained backend/cache behavior:

- prepared mesh/material facade and cache hits/misses;
- pipeline/layout/bind-group resource reuse;
- texture/sampler cache behavior;
- light and frame-resource cache reuse.

## Placement Recommendation

Do not add queued resource-set summaries to `WebGpuAppResourceReuseReport`.

Queued built-in resource sets describe current-frame derived route inputs after
material queue routing and before frame-resource preparation. They are not
retained GPU resources and are not cache hits, misses, evictions, or retained
resource identities.

Add a small exported helper near the WebGPU app resource routing area, ideally
in its own module so tests can cover it without reaching through private app
internals.

## Proposed Helper Shape

Use the narrow part of `MaterialQueueItem` needed for counting so the helper can
operate on current route items without exposing draw packets, source assets,
adapters, prepared resources, or WebGPU handles.

```ts
export interface QueuedBuiltInResourceSetSummaryItem {
  readonly materialFamily: MaterialQueueFamily;
  readonly pipelineKey: string;
  readonly renderPhase: RenderQueue;
}

export interface QueuedBuiltInResourceFamilyBucketSummary {
  readonly family: MaterialQueueFamily;
  readonly itemCount: number;
}

export interface QueuedBuiltInResourcePipelineBucketSummary {
  readonly pipelineKey: string;
  readonly itemCount: number;
}

export interface QueuedBuiltInResourceFamilyPipelineBucketSummary {
  readonly family: MaterialQueueFamily;
  readonly pipelineKey: string;
  readonly itemCount: number;
}

export interface QueuedBuiltInResourceSetSummary {
  readonly itemCount: number;
  readonly byFamily: readonly QueuedBuiltInResourceFamilyBucketSummary[];
  readonly byPipeline: readonly QueuedBuiltInResourcePipelineBucketSummary[];
  readonly byFamilyAndPipeline: readonly QueuedBuiltInResourceFamilyPipelineBucketSummary[];
}

export function createQueuedBuiltInResourceSetSummary(
  items: readonly QueuedBuiltInResourceSetSummaryItem[],
): QueuedBuiltInResourceSetSummary;
```

The first implementation can count directly from `resourceSet.items.map((item)
=> item.queueItem)` at call sites or tests. If app integration later needs a
single-call resource-set helper, add a private adapter in `app.ts` rather than
widening this public summary input.

## Sorting and Stability

Bucket order should be deterministic:

- families sorted alphabetically unless a material-family phase order already
  exists locally;
- pipeline keys sorted lexicographically;
- family/pipeline buckets sorted by family, then pipeline key.

The summary should allocate its own small arrays because it is an explicit
diagnostic/inspection helper, not a hot-path frame-resource preparation step.
If it becomes per-frame app-report data later, add caller-owned scratch in a
separate task.

## JSON Safety

The helper must not include:

- `MeshDrawPacket` records;
- source `MeshAsset` or material asset objects;
- material adapters;
- prepared resource records;
- GPU buffers, textures, samplers, bind groups, pipelines, devices, or queues;
- route failure diagnostics.

The only allowed dynamic strings are existing family names and stable pipeline
keys. Tests should assert `JSON.stringify(summary)` does not contain obvious
asset or GPU-handle strings from mixed-family fixtures.

## Relationship to Existing Summaries

- `MaterialQueuePhaseSummary` remains renderer-independent and summarizes queue
  items before WebGPU app routing.
- `RenderFrameQueueDiagnosticsSummary` remains frame-plan oriented and
  summarizes render-world readiness/draw-package state.
- This resource-set summary should sit between those two surfaces: it describes
  current-frame WebGPU app route results before retained backend resources are
  prepared.

## Focused Validation

Add tests covering:

- empty item array;
- mixed unlit, matcap, and standard items;
- multiple pipeline keys within one family;
- deterministic bucket ordering;
- JSON stringification without source asset or GPU-like handle strings.

Suggested commands:

- `pnpm exec vitest run test/webgpu/queued-built-in-resource-set-summary.test.ts`
- `pnpm exec tsc --noEmit -p packages/webgpu/tsconfig.json`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`

## Non-Goals

- No `WebGpuAppResourceReuseReport` changes.
- No app-level successful route report emission.
- No retained resource cache or invalidation changes.
- No route collector ownership changes.
- No material queue sorting changes.
- No source asset, ECS, or WebGPU handle exposure.

## Recommended Implementation Slice

Proceed with `task-0937`:

- add the helper as a WebGPU module with narrow summary input types;
- export it through `packages/webgpu/src/webgpu/index.ts`;
- test empty and mixed-family summaries directly;
- keep app report wiring out of scope.
