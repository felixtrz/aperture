# Diagnostics Summaries

This page lists the current JSON-safe diagnostics summary helpers and the
boundaries they are meant to preserve.

Aperture's source of truth remains ECS state and extracted render data.
Diagnostics summaries are inspection surfaces. They should not become hidden
renderer state, retained backend cache ownership, or a substitute for detailed
failure diagnostics.

## Helper Inventory

| Helper                                           | Package                   | Describes                                                                                                      | Does Not Own Or Expose                                                                                       | Allocation Shape                                  |
| ------------------------------------------------ | ------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------- |
| `createMaterialQueuePhaseSummary()`              | `@aperture-engine/render` | Material queue item counts by render phase and material family.                                                | WebGPU resources, source assets, render-world packages, or app reports.                                      | Allocating inspection helper.                     |
| `RenderWorldDrawPackageScratchSummary`           | `@aperture-engine/render` | Draw package counts, package-pool reuse, missing packed transforms, and package diagnostics.                   | Draw packets, snapshots, ECS worlds, or GPU handles.                                                         | Updated inside caller-owned draw-package scratch. |
| `createRenderFrameQueueDiagnosticsSummary()`     | `@aperture-engine/webgpu` | Render-frame queue readiness, draw-package counts, package scratch reuse, and queue diagnostic code counts.    | Backend cache state, frame resources, command buffers, snapshots, or WebGPU handles.                         | Allocating inspection helper.                     |
| `createQueuedBuiltInResourceSetSummary()`        | `@aperture-engine/webgpu` | Current-frame routed built-in app resource items by material family and pipeline key.                          | Source mesh/material assets, adapters, prepared resources, or GPU handles.                                   | Allocating inspection helper.                     |
| `createWebGpuAppDiagnosticsSummary()`            | `@aperture-engine/webgpu` | Optional grouping for existing material queue, routed resource-set, and render-frame queue summaries.          | App report schema ownership, resource reuse reports, snapshots, or raw frame resources.                      | Allocating grouping helper.                       |
| `createMaterialDependencyDiagnosticsSummary()`   | `@aperture-engine/webgpu` | Aggregate material dependency readiness counts by material kind, dependency kind, status, and diagnostic code. | Material/texture/sampler/dependency handles, source assets, prepared resources, or GPU handles.              | Allocating inspection helper.                     |
| `createStandardMaterialTextureFidelitySummary()` | `@aperture-engine/webgpu` | Aggregate StandardMaterial texture readiness counts by field and issue code.                                   | Material/texture/sampler handles, full readiness reports, source assets, prepared resources, or GPU handles. | Allocating inspection helper.                     |

## StandardMaterial Texture Fidelity

`createStandardMaterialTextureFidelitySummary()` summarizes existing
`StandardMaterialTextureReadinessReportJsonValue` records. It is meant for
dashboards, tests, and explicit diagnostics surfaces that need to know whether
StandardMaterial texture fidelity is blocked by sampler readiness, color-space
mismatch, semantic mismatch, unsupported UV sets, or unsupported texture
transforms.

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

## App Diagnostics Example

`examples/app-diagnostics.js` publishes an example-only `dependencySummary` for
failure scenarios. It is derived from public app report JSON with
`createMaterialDependencyDiagnosticsSummary()`.

The example still exposes detailed failure fields and full report JSON for
debugging. Those detailed fields may contain material, texture, sampler, or
dependency handle keys. The aggregate `dependencySummary` should not.

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
