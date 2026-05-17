# Generic Material-Family Queue-To-Prepare Handoff Plan - 2026-05-17

## Goal

Define the smallest next step from the current built-in material route adapters
to a generic material-family queue-to-prepare handoff.

The target is not a broad render graph rewrite. The target is a narrow contract
that lets a queued material-family item ask for prepared resources through a
family adapter without hard-coding the app facade around unlit, Matcap, and
StandardMaterial branches.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `packages/webgpu/src/webgpu/queued-material-adapter.ts`
- `packages/webgpu/src/webgpu/built-in-material-queue-adapter.ts`
- `packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/unlit-app-frame-resources.ts`
- `packages/webgpu/src/webgpu/matcap-app-frame-resources.ts`
- `packages/webgpu/src/webgpu/standard-app-frame-resources.ts`
- `packages/render/src/rendering/material-queue.ts`
- `references/bevy/crates/bevy_pbr/src/material.rs`
- `references/bevy/crates/bevy_render/src/render_phase/mod.rs`

## Existing State

Current Aperture already has useful pieces:

- `MaterialQueueItem` carries material family, render phase, pipeline key, mesh
  key, material key, queue order, and prepared resource key placeholders.
- `createQueuedMaterialAdapterRegistry()` can register adapters by family and
  diagnose duplicate families.
- Built-in route adapters validate phase/blend rules for unlit, Matcap, and
  StandardMaterial.
- App-local frame resource helpers prepare the actual mesh/material/texture,
  sampler, light, pipeline, and bind group resources for each built-in family.
- Prepared mesh/material facade keys keep the render package boundary separate
  from WebGPU-private backend caches.

The remaining drift is that the WebGPU app still has family-specific route
plumbing around the frame resource helpers. That makes adding or expanding a
material family likely to require another bespoke app route.

## Bevy Pattern To Adapt

Bevy separates the queue phase from render-asset preparation and draw execution:

- Materials define shader/bind/resource/pipeline behavior.
- Render assets are prepared into renderer-owned resources.
- Queue systems emit phase items for visible entities.
- Phase items carry enough typed keys to select draw functions and prepared
  resources later.

Aperture should adapt the concept, not the Rust trait shape. The TypeScript
version should remain explicit, JSON-safe at diagnostics boundaries, and
compatible with `RenderSnapshot`.

## Proposed Contract

Add a generic route contract around the existing built-in adapters:

```ts
interface QueuedMaterialPrepareRouteContext {
  readonly queueItem: MaterialQueueItem;
  readonly material: MaterialAsset;
  readonly sourceVersion: number;
  readonly frame: number;
}

interface QueuedMaterialPrepareRouteResult {
  readonly valid: boolean;
  readonly status: "prepared" | "reused" | "skipped" | "failed";
  readonly family: string;
  readonly materialKey: string;
  readonly meshResourceKey: string | null;
  readonly materialResourceKey: string | null;
  readonly pipelineKey: string;
  readonly diagnostics: readonly WebGpuAppMaterialQueueRouteDiagnostic[];
}

interface QueuedMaterialPrepareRouteAdapter {
  readonly kind: string;
  validateQueueItem(item: MaterialQueueItem): Diagnostic | null;
  acceptsMaterial(material: MaterialAsset): boolean;
  prepareRoute(
    context: QueuedMaterialPrepareRouteContext,
  ): QueuedMaterialPrepareRouteResult;
}
```

The first implementation slice should not move all resource preparation at once.
Instead, it should:

1. Define the contract and JSON-safe result shell.
2. Add tests that adapt the existing built-in family adapters into the contract.
3. Prove the contract can report success, skipped family, material mismatch,
   unsupported phase, and unsupported blend cases without raw GPU handles.
4. Keep existing app behavior unchanged.

## Ownership Rules

- ECS and source material assets remain renderer-independent.
- `RenderSnapshot` remains the transport boundary.
- Prepared facade resource keys are strings; raw buffers, bind groups, textures,
  samplers, pipelines, and command encoders stay WebGPU-private.
- The app facade may orchestrate adapters, but it should not become the owner of
  gameplay state or source asset authority.
- Diagnostics from this contract are current-frame route/readiness data, not
  retained backend cache summaries.

## Non-Goals

- Do not replace every app-local frame-resource helper in one step.
- Do not add custom shader plugin support.
- Do not add new material families.
- Do not change queue sort behavior, render phases, or draw submission behavior.
- Do not hide errors by silently falling back to scalar materials.

## Implementation Follow-Up

`task-0967` should add contract-level tests/helper around the existing built-in
route adapters. Keep the helper small enough that a later slice can wire the
app frame-resource path through it without a risky rewrite.
