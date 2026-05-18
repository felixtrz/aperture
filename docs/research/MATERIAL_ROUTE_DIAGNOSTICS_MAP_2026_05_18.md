# Material Route Diagnostics Map

Date: 2026-05-18

Task: `task-1637`

## Purpose

This is a compact map of the current WebGPU material route diagnostic layers
after the recent route-report, prepare-route, source-asset, frame-resource, and
diagnostics-summary helper extractions.

It is not a new architecture decision and does not add custom material support.
It records what exists so the next route/prepared-resource cleanup can be chosen
without re-reading the full audit chain.

## Layer Map

| Layer                                   | Source module                                                                    | Current diagnostic codes                                                                                                                               | Public / JSON surface                                                                      | Ownership                                                            |
| --------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| Material queue route report             | `packages/webgpu/src/webgpu/material-queue-route-report.ts`                      | Accepts normalized `webGpuApp.*` route diagnostics and arbitrary allowed route diagnostics through `unknownToWebGpuAppMaterialQueueRouteDiagnostics()` | `webGpuApp.materialQueueRouteReport.report` and `diagnosticsSummary.materialQueueRoute`    | Generic app route reporting infrastructure                           |
| Queued prepare route                    | `packages/webgpu/src/webgpu/queued-material-prepare-route.ts`                    | `queuedMaterialPrepareRoute.missingAdapter`, `queuedMaterialPrepareRoute.materialMismatch`                                                             | Internal route result diagnostics; not directly exposed by the app                         | Generic route validation infrastructure                              |
| Prepare-route app normalization         | `packages/webgpu/src/webgpu/queued-material-prepare-route-diagnostics.ts`        | `webGpuApp.unsupportedMaterialQueueFamily`, `webGpuApp.materialQueueAssetMismatch`                                                                     | App diagnostics and route-report diagnostics after normalization                           | Built-in/app compatibility policy over generic prepare-route results |
| Frame-resource route shell              | `packages/webgpu/src/webgpu/queued-material-frame-resource-route.ts`             | Summarizes frame-resource result diagnostics by code; does not create app diagnostics by itself                                                        | `QueuedMaterialFrameResourceRouteShell` and shell summaries                                | Generic frame-resource route metadata                                |
| Frame-resource app diagnostic           | `packages/webgpu/src/webgpu/queued-material-frame-resource-route-diagnostics.ts` | `webGpuApp.frameResourceRoute`                                                                                                                         | Failure-only app diagnostic with route shell payload                                       | App diagnostic wrapper over generic frame-resource route metadata    |
| App route/resource item report assembly | `packages/webgpu/src/webgpu/queued-material-app-resource-item.ts`                | `webGpuApp.materialQueueRouteReport`                                                                                                                   | Public diagnostic payload uses field name `report`                                         | Generic queued app item/report assembly                              |
| Diagnostics summary collection          | `packages/webgpu/src/webgpu/app-diagnostics-summary.ts`                          | Collects `webGpuApp.materialQueueRouteReport` and `webGpuApp.materialDependenciesNotReady`                                                             | `webGpuAppRenderReportToJsonValue().diagnosticsSummary` and `.materialDependencyReadiness` | App report JSON summary surface                                      |

## Boundary Notes

- `routeQueuedMaterialPrepare()` is generic route infrastructure. It should not
  know that Aperture currently supports only built-in app adapters.
- `queuedPrepareRouteDiagnosticToWebGpuAppDiagnostic()` is app/built-in policy.
  Its unsupported-family message names the active built-in families and should
  not be treated as custom material API design.
- `createQueuedMaterialFrameResourceRouteShell()` is generic metadata. It keeps
  facade queue keys separate from backend source-version resource keys and omits
  raw GPU resources.
- `createWebGpuAppFrameResourceRouteDiagnostic()` is app diagnostics policy. It
  should remain failure-only unless a later decision adds an explicit successful
  route reporting surface.
- `createQueuedMaterialAppRouteReportDiagnostic()` preserves the public nested
  field name `report`; `routeReport` is internal scratch terminology only.
- `diagnosticsSummary.routedResourceSet` is the public app summary field for
  generic frame-resource set summaries. Legacy family-specific resource-set
  summary fields should remain absent.

## JSON Safety

Current route diagnostics are expected to serialize without raw WebGPU handles,
callbacks, app objects, or source asset objects.

The safest inspection surfaces are:

- `webGpuApp.materialQueueRouteReport.report`
- `webGpuApp.frameResourceRoute.route`
- `diagnosticsSummary.materialQueue`
- `diagnosticsSummary.materialQueueRoute`
- `diagnosticsSummary.routedResourceSet`
- `materialDependencyReadiness`

When adding diagnostics, prefer stable keys, counts, statuses, source-version
resource keys, family names, phase names, and diagnostic codes. Avoid exposing
raw `GPUBuffer`, `GPUBindGroup`, `GPUTexture`, pipeline objects, adapter
callbacks, or mutable app state.

## Next Cleanup Candidates

### Candidate A — Route Diagnostics Overview In App Docs

Why select:

- Would expose the current diagnostics map to users instead of only agent
  research notes.
- Useful once route diagnostics stabilize enough to be called public API.

Why defer:

- The current route surfaces are still evolving toward real generic adapter
  support.
- Public docs should wait until one more route/prepared-resource cleanup
  confirms the shape is not churn.

### Candidate B — Frame-Resource Route Summary Collection

Why select:

- Could add an internal reusable collector for failed frame-resource route
  diagnostics if more failure producers appear.
- Would mirror the existing app diagnostics summary collector pattern.

Why defer:

- There is currently one app diagnostic code, `webGpuApp.frameResourceRoute`,
  and successful route shells intentionally stay out of default reports.
- A collector now would add abstraction before there are multiple consumers.

### Candidate C — Real Non-Built-In App Material Adapter Boundary

Why select:

- It is the meaningful route architecture milestone after built-in helper
  cleanup.

Why defer:

- It requires a source asset contract, backend adapter registration policy,
  prepared-resource contract, pipeline/shader behavior, diagnostics, and
  browser coverage. That is too broad for a follow-up unless broken into a
  smaller design task first.

## Recommended Next Planning Bias

For the next route/prepared-resource plan, prefer either:

- a small design/audit task that decomposes real non-built-in app material
  adapter support into safe vertical slices, or
- a narrow StandardMaterial/glTF fidelity proof if the route candidate would
  require implementing custom material rendering in one step.
