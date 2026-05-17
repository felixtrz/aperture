# Generic Frame Resource Adapter Contract Extraction Plan - 2026-05-17

## Goal

Plan the smallest safe contract extraction for built-in material frame-resource
adapter calls.

This follows the internal route-shell wrapper work and should prepare the next
implementation slice without moving all WebGPU app preparation code at once.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/research/INTERNAL_FRAME_RESOURCE_ROUTE_SHELL_BOUNDARY_AUDIT_2026_05_17.md`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts`
- `packages/webgpu/src/webgpu/queued-material-adapter.ts`
- `packages/webgpu/src/webgpu/queued-material-frame-resource-route.ts`
- `test/webgpu/built-in-material-app-resource-adapter.test.ts`
- `test/webgpu/queued-material-frame-resource-route.test.ts`
- `references/bevy/crates/bevy_render/src/render_phase/mod.rs`

## Current State

`QueuedBuiltInAppResourceAdapter` already combines:

- route validation behavior from `BuiltInMaterialQueueRouteAdapter`;
- texture/sampler preparation callbacks;
- frame-resource creation callbacks;
- family-specific append behavior for unlit, Matcap, and Standard frame
  resources.

`app.ts` still owns the full orchestration loop: pipeline creation, pipeline
layout lookup, texture/sampler preparation, frame-resource creation,
route-shell creation, resource bucketing, and resource-key maps.

## Proposed Contract

Add a small generic frame-resource adapter result contract near
`built-in-material-app-resource-adapter.ts`:

```ts
export interface QueuedMaterialFrameResourceAdapterResult<
  TResources = unknown,
  TDiagnostic = unknown,
> {
  readonly valid: boolean;
  readonly resources: TResources | null;
  readonly diagnostics: readonly TDiagnostic[];
}

export interface QueuedMaterialFrameResourceAdapterContext<TItem, TOptions> {
  readonly item: TItem;
  readonly options: TOptions;
}
```

The first implementation should be type/adapter coverage only. It should not
move `prepareQueuedBuiltInFrameResources()` out of `app.ts`.

## Implementation Slice

For `task-0997`:

1. Introduce the small generic result/context type.
2. Narrow `CreateQueuedBuiltInFamilyFrameResourcesResult` so it satisfies the
   generic result contract.
3. Add tests in `test/webgpu/built-in-material-app-resource-adapter.test.ts`
   proving built-in unlit, Matcap, and Standard frame callbacks still compose
   through the registry and return the generic result shape.
4. Keep all existing app tests unchanged except for targeted imports/types if
   needed.

## Key Preservation

The contract must not blur:

- facade queue keys from material queue items and prepare routes;
- backend source-version mesh/material keys used by WebGPU resource caches;
- retained cache summary keys.

The new type should describe result shape only. It should not decide which key
family is used by backend caches.

## Non-Goals

- Do not move `prepareQueuedBuiltInFrameResources()` out of `app.ts`.
- Do not replace unlit, Matcap, or Standard frame-resource helpers.
- Do not change successful app report shape.
- Do not add successful-frame route-shell report fields.
- Do not change texture/sampler preparation, pipeline creation, bind group
  layout selection, cache summaries, or draw submission.

## Validation

Suggested commands:

- `pnpm exec vitest run test/webgpu/built-in-material-app-resource-adapter.test.ts`
- `pnpm exec vitest run test/webgpu/queued-material-frame-resource-route.test.ts`
- `pnpm exec tsc --noEmit -p packages/webgpu/tsconfig.json`
