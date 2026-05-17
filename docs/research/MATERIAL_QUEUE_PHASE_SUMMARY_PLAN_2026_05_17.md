# Material Queue Phase Summary Plan - 2026-05-17

## Scope

Plan a JSON-safe summary helper for `MaterialQueuePlan` items by render phase
and material family.

This is a planning slice only. It does not change queue ordering, render
extraction, prepared-resource key resolution, WebGPU app routing, backend cache
reports, or draw submission.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/NORTH_STAR.md`
- `docs/research/STABLE_MATERIAL_QUEUE_ORDERING_PLAN_2026_05_17.md`
- `docs/research/STABLE_MATERIAL_QUEUE_ORDERING_BOUNDARY_AUDIT_2026_05_17.md`
- `packages/render/src/rendering/material-queue.ts`
- `packages/render/src/rendering/index.ts`
- `test/rendering/material-queue.test.ts`
- `packages/webgpu/src/webgpu/material-queue-route-report.ts`
- `references/bevy/crates/bevy_render/src/render_phase/mod.rs`
- `references/bevy/crates/bevy_pbr/src/material.rs`

## Reference Pattern

Bevy queues renderable entities into explicit per-view render phases. Opaque and
alpha-mask material draws go into binned phases, while transparent-style draws
go into sorted phases. Phase sorting is a render-stage operation after queueing,
not a mutation of main-world ECS state.

Aperture's current queue is smaller and TypeScript-first, but it follows the
same architecture direction: `writeMaterialQueueFromSnapshot()` derives
`MaterialQueueItem`s from `RenderSnapshot.meshDraws`, resolves prepared resource
keys, sorts derived items, and leaves ECS and the source snapshot unchanged.

## Current Gap

`MaterialQueuePlan` exposes the sorted `items` array and diagnostics, but there
is no compact summary that answers:

- how many queue items exist per render phase;
- how many queue items exist per material family;
- how material families are distributed within each phase.

`WebGpuAppMaterialQueueRouteReport` has similar family/phase bucket summaries,
but it lives in `@aperture-engine/webgpu` and describes WebGPU app route success
or failure. The render package needs a renderer-independent summary over the
derived material queue itself.

## Proposed Helper Shape

Add a helper in `packages/render/src/rendering/material-queue.ts`:

```ts
export interface MaterialQueuePhaseBucketSummary {
  readonly phase: RenderQueue;
  readonly itemCount: number;
}

export interface MaterialQueueFamilyBucketSummary {
  readonly family: MaterialQueueFamily;
  readonly itemCount: number;
}

export interface MaterialQueuePhaseFamilyBucketSummary {
  readonly phase: RenderQueue;
  readonly family: MaterialQueueFamily;
  readonly itemCount: number;
}

export interface MaterialQueuePhaseSummary {
  readonly itemCount: number;
  readonly byPhase: readonly MaterialQueuePhaseBucketSummary[];
  readonly byFamily: readonly MaterialQueueFamilyBucketSummary[];
  readonly byPhaseAndFamily: readonly MaterialQueuePhaseFamilyBucketSummary[];
}

export function createMaterialQueuePhaseSummary(
  items: readonly MaterialQueueItem[],
): MaterialQueuePhaseSummary;
```

Sort summary buckets deterministically:

- `byPhase`: `opaque`, `alpha-test`, `transparent`;
- `byFamily`: lexical family order;
- `byPhaseAndFamily`: phase order, then lexical family order.

This keeps the helper useful for tests, diagnostics, and eventual app summaries
without making report consumers depend on the full queue item payload.

## JSON-Safety Rules

The summary should include only scalar strings and counts.

It must not expose:

- `MeshDrawPacket` or `RenderSnapshot` payloads;
- ECS world references;
- asset registry entries or source assets;
- prepared mesh/material store entries;
- WebGPU devices, buffers, textures, bind groups, pipelines, or command objects.

Because `MaterialQueueItem.materialFamily`, `renderPhase`, and counts are
already scalar data, JSON projection can be the object itself. A dedicated JSON
helper is not necessary unless a future app report needs compatibility
translation.

## Report Placement

Keep this separate from `WebGpuAppResourceReuseReport`.

The queue phase summary describes derived queue items. It does not describe
retained backend caches, prepared-resource facades, texture/sampler caches,
pipeline cache hits, bind group reuse, or draw package scratch reuse.

Near-term placement:

1. Add the helper and focused render tests only.
2. Keep WebGPU app route reports unchanged.
3. Consider app/frame-plan integration later only if a concrete diagnostics
   consumer needs queue phase/family counts.

## Focused Validation

Add tests in `test/rendering/material-queue.test.ts` covering:

- empty queues;
- mixed phases;
- mixed material families;
- deterministic summary bucket order;
- JSON stringification without source assets, handles, or GPU-like payloads.

Suggested commands:

- `pnpm exec vitest run test/rendering/material-queue.test.ts`
- `pnpm exec tsc --noEmit -p packages/render/tsconfig.json`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`

## Non-Goals

- No material queue sorting changes.
- No app route report changes.
- No backend cache summaries or resource reuse counters.
- No render-world draw package, draw command, or WebGPU submission changes.
- No ECS, source asset, or GPU handle exposure.

## Recommended Implementation Slice

Proceed with `task-0927`:

- implement `createMaterialQueuePhaseSummary()` in
  `packages/render/src/rendering/material-queue.ts`;
- export it through the existing render package barrel;
- add focused material queue tests for empty, mixed-phase, and mixed-family
  summaries.
