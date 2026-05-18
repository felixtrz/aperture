# Diagnostics Summaries

This page lists the current JSON-safe diagnostics summary helpers and the
boundaries they are meant to preserve.

Aperture's source of truth remains ECS state and extracted render data.
Diagnostics summaries are inspection surfaces. They should not become hidden
renderer state, retained backend cache ownership, or a substitute for detailed
failure diagnostics.

## Helper Inventory

| Helper                                                   | Package                   | Describes                                                                                                                                  | Does Not Own Or Expose                                                                                                                  | Allocation Shape                                  |
| -------------------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `createMaterialQueuePhaseSummary()`                      | `@aperture-engine/render` | Material queue item counts by render phase and material family.                                                                            | WebGPU resources, source assets, render-world packages, or app reports.                                                                 | Allocating inspection helper.                     |
| `RenderWorldDrawPackageScratchSummary`                   | `@aperture-engine/render` | Draw package counts, package-pool reuse, missing packed transforms, and package diagnostics.                                               | Draw packets, snapshots, ECS worlds, or GPU handles.                                                                                    | Updated inside caller-owned draw-package scratch. |
| `createRenderFrameQueueDiagnosticsSummary()`             | `@aperture-engine/webgpu` | Render-frame queue readiness, draw-package counts, package scratch reuse, and queue diagnostic code counts.                                | Backend cache state, frame resources, command buffers, snapshots, or WebGPU handles.                                                    | Allocating inspection helper.                     |
| `createQueuedBuiltInResourceSetSummary()`                | `@aperture-engine/webgpu` | Current-frame routed built-in app resource items by material family and pipeline key.                                                      | Source mesh/material assets, adapters, prepared resources, or GPU handles.                                                              | Allocating inspection helper.                     |
| `createQueuedMaterialRouteSummaryGroup()`                | `@aperture-engine/webgpu` | Compact grouped health for queued material prepare-route and frame-resource-route summary stages.                                          | Raw route keys, material keys, resource keys, raw diagnostics, frame resources, backend cache maps, or handles.                         | Allocating inspection helper.                     |
| `createWebGpuAppDiagnosticsSummary()`                    | `@aperture-engine/webgpu` | Optional grouping for existing material queue, routed resource-set, and render-frame queue summaries.                                      | App report schema ownership, resource reuse reports, snapshots, or raw frame resources.                                                 | Allocating grouping helper.                       |
| `createMaterialDependencyDiagnosticsSummary()`           | `@aperture-engine/webgpu` | Aggregate material dependency readiness counts by material kind, dependency kind, status, and diagnostic code.                             | Material/texture/sampler/dependency handles, source assets, prepared resources, or GPU handles.                                         | Allocating inspection helper.                     |
| `createStandardMaterialTextureFidelitySummary()`         | `@aperture-engine/webgpu` | Aggregate StandardMaterial texture readiness counts by field and issue code.                                                               | Material/texture/sampler handles, full readiness reports, source assets, prepared resources, or GPU handles.                            | Allocating inspection helper.                     |
| `createRenderWorldPreparedResourceSummary()`             | `@aperture-engine/render` | Prepared mesh/material facade counts, render-world binding counts, draw-readiness counts, and diagnostic totals.                           | WebGPU backend caches, buffers, textures, samplers, bind groups, pipelines, source assets, or detailed entries.                         | Allocating inspection helper.                     |
| `createStandardMaterialSamplerFidelityReport()`          | `@aperture-engine/render` | Ready StandardMaterial texture/sampler pair fidelity warnings for mip filtering, LOD range, and authored anisotropy.                       | Texture source payloads, sampler objects, prepared resources, mip generation, upload behavior, or GPU handles.                          | Allocating inspection helper.                     |
| `createStandardMaterialSamplerFidelitySummary()`         | `@aperture-engine/webgpu` | Aggregate sampler fidelity warning counts by texture field and diagnostic code.                                                            | Material/texture/sampler handles, raw sampler reports, source assets, prepared resources, or GPU handles.                               | Allocating inspection helper.                     |
| `createStandardMaterialTextureSamplerAlignmentSummary()` | `@aperture-engine/render` | Compact alignment of blocking StandardMaterial texture readiness and non-blocking sampler fidelity warnings.                               | Registry state, source assets, texture/sampler handles, prepared resources, app reports, or GPU handles.                                | Allocating inspection helper.                     |
| `createPreparedResourceLifetimeAlignmentSummary()`       | `@aperture-engine/webgpu` | Compact comparison of prepared facade counts against backend resource inspection counts.                                                   | Facade ownership, backend cache maps, raw resources, app report schema, or GPU handles.                                                 | Allocating inspection helper.                     |
| `createPreparedResourceAppReuseAlignmentSummary()`       | `@aperture-engine/webgpu` | Compact comparison of render prepared facade counts against WebGPU app reuse prepared facade and resource counters.                        | Render-package ownership, backend cache maps, raw resources, default app report fields, or GPU handles.                                 | Allocating inspection helper.                     |
| `createEnvironmentMapReadinessReport()`                  | `@aperture-engine/webgpu` | Extracted environment packet counts, null-handle counts, required environment-map resource keys, and optional renderer resource readiness. | Raw environment handles, WebGPU textures, texture views, samplers, bind groups, backend cache maps, source payloads, or IBL activation. | Allocating inspection helper.                     |

## StandardMaterial Texture Fidelity

`createStandardMaterialTextureFidelitySummary()` summarizes existing
`StandardMaterialTextureReadinessReportJsonValue` records. It is meant for
dashboards, tests, and explicit diagnostics surfaces that need to know whether
StandardMaterial texture fidelity is blocked by sampler readiness, color-space
mismatch, color-space/format mismatch, semantic mismatch, unsupported UV sets,
or unsupported texture transforms.

The summary buckets by stable texture field names and diagnostic codes. It does
not include material keys, texture keys, sampler keys, raw readiness reports,
source asset objects, prepared resources, or WebGPU handles.

The helper does not change rendering. It does not add IBL, shadows, new texture
fields, texture upload behavior, sampler creation behavior, bind group layouts,
pipeline specialization, or app report wiring.

Use it manually when a diagnostics example or test already has StandardMaterial
texture readiness JSON:

```ts
const summary = createStandardMaterialTextureFidelitySummary(readinessReports);
```

Do not add this summary to every successful app frame by default. If app report
exposure is needed later, make it opt-in and keep it separate from
`resourceReuse`.

## StandardMaterial Sampler Fidelity

`createStandardMaterialSamplerFidelityReport()` inspects ready
StandardMaterial texture/sampler pairs and reports warning-level fidelity issues
that can make rendered output differ from author or glTF viewer expectations.
Current checks cover mip filtering on single-mip textures, `lodMaxClamp` values
outside the available texture mip range, and authored anisotropy that is not yet
reflected in the current StandardMaterial readiness/diagnostics path.

The helper is renderer-independent. It does not create WebGPU samplers, generate
mips, upload textures, mutate source assets, prepare resources, or add default
app-frame report fields. Its JSON output includes stable material, texture, and
sampler keys plus numeric sampler/texture facts needed to explain warnings, but
not texture source payloads, sampler objects, cache maps, or GPU handles.

`createStandardMaterialSamplerFidelitySummary()` aggregates those detailed
reports for dashboards or explicit diagnostics examples. It counts warnings by
field and diagnostic code, and separates mip-filter, LOD-range, and anisotropy
issue totals. Like the texture fidelity summary, it should remain opt-in and
outside default successful app-frame reports.

`createStandardMaterialTextureSamplerAlignmentSummary()` pairs existing
texture-readiness JSON with sampler-fidelity JSON. Use it when a diagnostics
consumer needs one compact view that separates blocking texture readiness issues
from non-blocking sampler fidelity warnings. It does not change readiness
semantics, inspect the registry, create resources, generate mips, or expose
texture/sampler handles.

## App Diagnostics Example

`examples/app-diagnostics.js` publishes an example-only `dependencySummary` for
failure scenarios. It is derived from public app report JSON with
`createMaterialDependencyDiagnosticsSummary()`.

The example still exposes detailed failure fields and full report JSON for
debugging. Those detailed fields may contain material, texture, sampler, or
dependency handle keys. The aggregate `dependencySummary` should not.

## Queued Material Route Summaries

`createQueuedMaterialPrepareRouteSummary()` and
`createQueuedMaterialRouteSummaryGroup()` provide compact route health for
explicit diagnostics consumers. The prepare summary mirrors the frame-resource
route shell summary boundary: validity, status, family, resource-key presence
booleans, pipeline/frame facts, and diagnostic code counts.

The grouped summary combines prepare-route and frame-resource-route summary
counts by stage. It does not replace failure diagnostics and is not emitted by
default on successful app frames.

## Material Route Diagnostics Layers

Material route diagnostics are split across generic route infrastructure and
app compatibility policy. Keep these layers distinct when reading reports or
adding new diagnostics:

| Layer                           | Primary Module                                                                   | JSON / Public Surface                                                                                                                              | Boundary                                                                                                                |
| ------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Material queue route report     | `packages/webgpu/src/webgpu/material-queue-route-report.ts`                      | `webGpuApp.materialQueueRouteReport.report`, `diagnosticsSummary.materialQueueRoute`                                                               | Generic app route reporting. Normalizes allowed route diagnostics without owning adapters, assets, or GPU resources.    |
| Queued prepare route            | `packages/webgpu/src/webgpu/queued-material-prepare-route.ts`                    | Internal prepare-route result diagnostics                                                                                                          | Generic route validation. Reports missing adapters and material mismatches before app-specific normalization.           |
| Prepare-route app normalization | `packages/webgpu/src/webgpu/queued-material-prepare-route-diagnostics.ts`        | App diagnostics such as `webGpuApp.unsupportedMaterialQueueFamily` and `webGpuApp.materialQueueAssetMismatch`                                      | Built-in/app compatibility policy over generic prepare-route failures.                                                  |
| Frame-resource route shell      | `packages/webgpu/src/webgpu/queued-material-frame-resource-route.ts`             | `QueuedMaterialFrameResourceRouteShell` and shell summaries                                                                                        | Generic frame-resource metadata. Records facade/backend resource keys and diagnostic-code counts without raw resources. |
| Frame-resource app diagnostic   | `packages/webgpu/src/webgpu/queued-material-frame-resource-route-diagnostics.ts` | `webGpuApp.frameResourceRoute`                                                                                                                     | App diagnostic wrapper for failed frame-resource routes. Successful route shells stay out of default app reports.       |
| App route item report assembly  | `packages/webgpu/src/webgpu/queued-material-app-resource-item.ts`                | `webGpuApp.materialQueueRouteReport` with nested `report`                                                                                          | Generic queued app item/report assembly. `routeReport` remains internal scratch terminology.                            |
| Diagnostics summary collection  | `packages/webgpu/src/webgpu/app-diagnostics-summary.ts`                          | `diagnosticsSummary.materialQueue`, `diagnosticsSummary.materialQueueRoute`, `diagnosticsSummary.routedResourceSet`, `materialDependencyReadiness` | App report JSON summary grouping. Does not become cache ownership or renderer state.                                    |

Route-family strings at these layers are adapter/report keys. They are not
public custom material source asset kinds by themselves, and they do not imply
that a material family can render. Current public source material kinds remain
closed until a separate decision defines custom material source validation,
shader/resource dependencies, preparation, and lifecycle.

Unsupported or colliding route-family keys should stay visible through
diagnostics. They must not silently override an existing adapter, fallback to a
built-in family, or create renderer-owned source material state.

JSON-safe route diagnostics may include stable family names, phase names,
resource keys, source versions, statuses, counts, and diagnostic codes. They
must not expose raw `GPUBuffer`, `GPUBindGroup`, `GPUTexture`, texture views,
samplers, pipelines, shader modules, adapter callbacks, app objects, mutable
cache maps, source asset payloads, or hidden override/fallback behavior.

## Render-World Prepared Resource Summary

`createRenderWorldPreparedResourceSummary()` is a renderer-independent summary
for prepared facade state. It is useful when comparing source-side prepared mesh
and material entries with render-world resource-key binding readiness before
looking at WebGPU backend cache summaries.

`createRenderWorldPreparedResourceSummaryFromReport()` is the matching consumer
helper for the standard render-package
`prepareAndBindSnapshotPreparedResourcesToRenderWorld()` report shape. It
delegates to the same compact summary while counting apply/preparation,
binding, draw-readiness, and caller diagnostics once.

The helper reports compact counts only: prepared mesh entries, prepared material
entries by family, optional binding updated/missing counts, optional
ready/blocked draw counts, and diagnostic severity totals. It deliberately does
not include prepared store entry arrays, pipeline keys, texture or sampler
objects, retained backend cache maps, or WebGPU handles.

Use the WebGPU `RenderResourceSummaryReport` for backend resource counts such as
buffers, textures, samplers, bind groups, shader modules, pipelines, and cache
inspection.

## Prepared Resource Lifetime Alignment

`createPreparedResourceLifetimeAlignmentSummary()` compares compact prepared
facade counts with WebGPU backend resource summary counts. It helps flag cases
where facade prepared entries exist while backend inspection reports missing,
stale, or pending-destroy resources.

The helper lives in `@aperture-engine/webgpu` because it consumes backend
resource summary counts. It does not mutate caches, alter eviction policy, pull
backend cache maps into render-package summaries, expose raw resources, or add a
default successful-frame app report field.

`createPreparedResourceAppReuseAlignmentSummary()` compares the render-package
prepared summary's compact facade counts with the WebGPU app reuse report's
prepared facade counts and creation/reuse counters. Use it when a diagnostics
consumer needs to confirm that render prepared counts and app report prepared
facade counts agree without inspecting backend cache maps.

The helper intentionally lives in `@aperture-engine/webgpu`, remains opt-in, and
does not add a default successful-frame app report field.

## Resource Reuse Boundary

Do not place current-frame queue or dependency readiness summaries inside
`WebGpuAppResourceReuseReport`.

Resource reuse reports describe retained backend/cache behavior: pipeline,
buffer, texture, sampler, bind group, prepared asset, and light resource reuse.
Queue/dependency summaries describe current-frame planning and readiness.

If a future app report exposes diagnostics summaries, add a dedicated sibling
field such as `diagnosticsSummary`, not a child of `resourceReuse`.

## Hot-Path Allocation Boundary

Allocating summary helpers are acceptable for tests, examples, one-shot
inspection, and explicit diagnostics surfaces.

Before wiring any allocating helper into every successful app frame, add a
caller-owned scratch or stable result shell. Existing frame-loop writers already
use scratch for material queues, draw packages, render-frame plans, and queued
built-in route collection.
