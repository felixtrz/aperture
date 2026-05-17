# Generic App Frame Resource Adapter Migration Plan - 2026-05-17

## Goal

Define the smallest safe next slice after `task-0971`: move built-in family
frame-resource preparation toward a generic app adapter shell without changing
successful frame output or collapsing key ownership boundaries.

This is not a render graph rewrite and not a custom material plugin system. The
target is a narrow shell around the existing `createFrameResources` callbacks so
the app facade can invoke material-family preparation through one route result
shape.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/research/GENERIC_APP_ROUTE_REPORTING_BOUNDARY_AUDIT_2026_05_17.md`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/queued-material-prepare-route.ts`
- `packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts`
- `packages/webgpu/src/webgpu/unlit-app-frame-resources.ts`
- `packages/webgpu/src/webgpu/matcap-app-frame-resources.ts`
- `packages/webgpu/src/webgpu/standard-app-frame-resources.ts`
- `references/bevy/crates/bevy_pbr/src/material.rs`
- `references/bevy/crates/bevy_render/src/render_phase/mod.rs`

## Current State

The app collection path now validates each queued built-in material item through
`routeQueuedMaterialPrepare()`. Once the route is valid, the app still calls the
existing family-specific `prepareTextureSamplerResources()` and
`createFrameResources()` callbacks through `QueuedBuiltInAppResourceAdapter`.

That means the app route validation is generic, but frame resource preparation
is still shaped around built-in family callbacks.

## Important Key Split

The next slice must preserve two different key families:

- Facade queue keys: `MaterialQueueItem.meshResourceKey` and
  `MaterialQueueItem.materialResourceKey`. These describe renderer-independent
  prepared facade resources used by queue/reporting surfaces.
- Backend preparation keys: source handle/version keys from indexed source mesh
  and material assets. Existing WebGPU frame resource helpers use these keys for
  backend cache reuse.

Do not feed facade queue keys into backend frame resource cache slots unless the
backend cache contract is deliberately redesigned and covered by tests.

## Proposed Next Contract

Add a generic shell around the existing built-in frame resource callbacks:

```ts
interface QueuedMaterialFrameResourceRouteContext {
  readonly prepareRoute: QueuedMaterialPrepareRouteResult;
  readonly item: QueuedBuiltInAppResourceItem;
  readonly snapshot: RenderSnapshot;
}

interface QueuedMaterialFrameResourceRouteResult {
  readonly valid: boolean;
  readonly family: string;
  readonly status: "prepared" | "reused" | "failed";
  readonly backendMeshKey: string;
  readonly backendMaterialKey: string;
  readonly diagnostics: readonly unknown[];
}
```

The first implementation should not replace unlit, Matcap, and Standard frame
helpers. It should wrap them so tests can prove:

- The route result is passed through as validation/report context.
- Backend mesh/material keys remain source-version keys.
- The shell returns JSON-safe diagnostics and no raw GPU handles.
- Existing successful mixed-family app tests keep the same resource reuse
  counts.

## Non-Goals

- Do not add new material families.
- Do not change pipeline creation or bind group layout selection.
- Do not merge retained cache summaries into route diagnostics.
- Do not rename public app diagnostics unless a compatibility plan is added.
- Do not move all WebGPU app preparation behind a generic abstraction in one
  patch.

## Implementation Follow-Up

`task-0975` should add a small frame-resource adapter shell/helper plus tests.
Keep the write scope to `packages/webgpu/src/webgpu` and targeted WebGPU tests.
The helper should sit next to the existing built-in app resource adapter code so
a later slice can wire the app frame path through it without a broad rewrite.
