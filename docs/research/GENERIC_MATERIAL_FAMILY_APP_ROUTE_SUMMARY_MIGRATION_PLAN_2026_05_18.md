# Generic Material-Family App Route Summary Migration Plan

Date: 2026-05-18

## Scope

Decide whether app diagnostics summaries should consume generic collector
summaries before another material family is added. This is a planning note only;
it does not change render behavior.

## References Inspected

- `docs/research/GENERIC_MATERIAL_FAMILY_FRAME_RESOURCE_ADAPTER_INTERFACE_PLAN_2026_05_18.md`
- `docs/research/GENERIC_FRAME_RESOURCE_COLLECTOR_AUDIT_2026_05_18.md`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/app-diagnostics-summary.ts`
- `packages/webgpu/src/webgpu/queued-material-frame-resource-set.ts`
- `packages/webgpu/src/webgpu/queued-built-in-frame-resource-set.ts`
- `packages/webgpu/src/webgpu/queued-built-in-resource-set-summary.ts`
- `test/webgpu/app-diagnostics-summary.test.ts`
- `test/webgpu/webgpu-app.test.ts`

## Current Shape

Successful queued built-in frames publish app diagnostics summary sections for:

- `materialQueue`
- `routedResourceSet`

`routedResourceSet` is created in `app.ts` from
`QueuedBuiltInAppResourceSet.items` before frame-resource preparation. Its
summary type is `QueuedBuiltInResourceSetSummary`, and it counts items by family
and pipeline.

Failed route collection publishes a separate `materialQueueRoute` section by
extracting the JSON-safe route report diagnostic.

This is useful, but the naming and type are still built-in-specific. Adding a
new material family should not require a parallel app-summary field or a second
summary path in `app.ts`.

## Decision

Migrate the successful resource-set summary to a generic queued material summary
before adding another material family route.

The current counts are already generic in content:

- item count
- by material family
- by pipeline key
- by family and pipeline

The migration should therefore be a rename/type move rather than a behavior
change. Keep the existing built-in public JSON stable for one slice by either:

- preserving `routedResourceSet` as the app diagnostics field name while its
  implementation type becomes generic; or
- adding a generic `queuedFrameResourceSet` field and keeping
  `routedResourceSet` as a temporary alias if tests/examples need compatibility.

Prefer preserving `routedResourceSet` in the public app report for now. The
internal type and helper can become generic without changing browser examples.

## Smallest Contract

Introduce a generic summary helper near the generic collector:

```ts
interface QueuedMaterialFrameResourceSummaryItem {
  readonly materialFamily: string;
  readonly pipelineKey: string;
  readonly renderPhase: string;
}

interface QueuedMaterialFrameResourceSetSummary {
  readonly itemCount: number;
  readonly byFamily: readonly {
    readonly family: string;
    readonly itemCount: number;
  }[];
  readonly byPipeline: readonly {
    readonly pipelineKey: string;
    readonly itemCount: number;
  }[];
  readonly byFamilyAndPipeline: readonly {
    readonly family: string;
    readonly pipelineKey: string;
    readonly itemCount: number;
  }[];
}
```

The built-in wrapper can map `QueuedBuiltInAppResourceItem` to this generic item
shape. A future material family only needs to expose the same summary fields on
its queued item or adapter.

## Migration Steps

1. Move or duplicate `createQueuedBuiltInResourceSetSummary()` into a generic
   `queued-material-frame-resource-set-summary.ts` helper.
2. Re-export the generic summary type from the WebGPU package.
3. Make `QueuedBuiltInResourceSetSummary` a type alias or compatibility wrapper
   over the generic summary for one migration slice.
4. Change `app-diagnostics-summary.ts` to type `routedResourceSet` as the
   generic summary while keeping the JSON field name unchanged.
5. Update app diagnostics summary tests to assert the generic type and current
   JSON shape.
6. Keep route-failure `materialQueueRoute` unchanged; it summarizes queue route
   diagnostics, not prepared frame resources.

## Non-Goals

- Do not add a new material family in the same task.
- Do not change the public report field name unless a separate decision records
  a compatibility break.
- Do not make the generic collector own app diagnostics assembly.
- Do not expose raw resources, bind groups, pipelines, device/context/canvas
  objects, or source asset payloads in the summary.

## Follow-Up Task

### task-1162 — Move queued resource-set summary to generic material helper

Category: `webgpu-render`
Package/write-scope: `packages/webgpu/src/webgpu`,
`test/webgpu/app-diagnostics-summary.test.ts`, and targeted app diagnostics
tests.
Reference anchor: this plan,
`packages/webgpu/src/webgpu/queued-built-in-resource-set-summary.ts`,
`packages/webgpu/src/webgpu/queued-material-frame-resource-set.ts`, and
`packages/webgpu/src/webgpu/app-diagnostics-summary.ts`.

Acceptance criteria:

- Add a generic queued material frame-resource summary helper with the existing
  item/family/pipeline counts.
- Keep the public app diagnostics field name `routedResourceSet` stable.
- Make the built-in summary helper a compatibility wrapper or type alias over
  the generic helper.
- Existing app diagnostics summary and WebGPU app tests pass.
