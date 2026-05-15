# Render Frame Readiness Reports

The MVP renderer path uses small data-only reports to explain whether an extracted frame is ready to become WebGPU work. These reports are diagnostics and orchestration data. They are not ECS state, and they do not make the renderer authoritative for gameplay or transforms.

## Report Chain

Renderer assembly smoke report:

- Checks that extracted render snapshot inspection, snapshot cloneability, draw package inspection, renderer resource summaries, and frame reports are present and ready.
- Summarizes snapshot, package, resource, and frame counts without exposing renderer-owned GPU objects.

Render pass assembly smoke report:

- Checks draw-list planning, render-pass resource resolution, command planning, and command execution.
- Carries draw and command counts plus diagnostics for missing pipelines, bind groups, buffers, or pass encoder methods.
- `runInjectedRenderPassAssembly` resolves resources, plans commands, executes them against an injected pass encoder, and derives the render-pass assembly smoke report.
- `renderPassAssemblySmokeReportToJsonValue` and `renderPassAssemblySmokeReportToJson` expose section readiness, counts, sanitized resource summaries, execution summaries, and diagnostic summaries without raw pipelines, bind groups, buffers, or pass encoder objects.

Frame submission smoke report:

- Checks render-pass attachment planning, pass begin, command execution, pass end, command encoder finish, and queue submit.
- Summaries use booleans, counts, and stable resource keys. Command encoders, pass encoders, command buffers, and queue handles stay outside the summary surface.

Frame boundary validation report:

- Combines frame-boundary smoke readiness, clear compatibility, and merged source diagnostics.
- Counts smoke diagnostics, compatibility diagnostics, source diagnostics, warnings, and errors.

Frame execution report:

- Derives frame-boundary smoke, clear compatibility, source diagnostic summary, frame-boundary validation, frame-submission smoke, and command-submission metrics from one frame-boundary assembly report.
- Reports section presence/readiness, command counts, draw-call counts, command-buffer counts, submission counts, and diagnostics grouped by top-level execution section.
- `frameExecutionReportToJsonValue` and `frameExecutionReportToJson` expose serializable section statuses, counts, and diagnostic summaries without nested frame-boundary reports or WebGPU handles.

MVP frame readiness report:

- Aggregates renderer assembly, render-pass assembly, frame submission, and frame-boundary validation.
- Reports overall readiness, per-section readiness, key diagnostic counts, diagnostics, and JSON-safe summaries.

Renderer frame summary report:

- Combines renderer assembly, render-pass assembly, frame submission, frame-boundary validation, MVP readiness, and command-submission metrics.
- Reports overall readiness, section presence/readiness, planned draw counts, executed command counts, submitted command-buffer counts, and a diagnostic summary.
- `createRendererFrameSummaryFromExecutionReport` derives the frame-submission, frame-boundary, MVP readiness, and command-submission inputs from an existing `FrameExecutionReport`, while keeping renderer assembly and render-pass assembly as explicit caller-provided inputs.
- `runInjectedRendererFrameSummary` combines explicit renderer and render-pass assembly reports with injected frame execution inputs, then returns the boundary assembly, frame execution report, renderer frame summary, and JSON summary.
- `runInjectedRenderFrame` composes `runInjectedRenderPassAssembly` with `runInjectedRendererFrameSummary`: callers provide renderer assembly, render-pass resources/pass encoder, and frame execution context/device/queue inputs, and the helper uses the render-pass command plan as the frame execution command input.
- `runInjectedRenderFrameFromDrawCommands` starts one step earlier: callers provide draw-command descriptors, and the helper plans the render-pass draw list before invoking `runInjectedRenderFrame`.
- `runInjectedRenderFrameFromDrawPackages` starts from render-world draw packages and mesh resources, creates draw-command descriptors, then invokes `runInjectedRenderFrameFromDrawCommands`.
- `runInjectedRenderFrameFromRenderWorldPackages` starts from render-world draw readiness plus packed snapshot transforms, plans render-world draw packages, then invokes `runInjectedRenderFrameFromDrawPackages`.
- `runInjectedRenderFrameFromSnapshot` starts from a `RenderSnapshot`, applies it to a caller-owned `RenderWorld`, updates caller-provided resource bindings, packs snapshot transforms, derives render-world draw readiness, and then invokes `runInjectedRenderFrameFromRenderWorldPackages`.

## Helper Relationships

Render-pass assembly derived helpers:

- `runInjectedRenderPassAssembly` starts from render-pass draw-list records plus renderer-owned pipeline, bind-group, mesh-buffer resources, and an injected pass encoder.
- The runner returns resource resolution, command planning, command execution, and render-pass assembly reports. The first three returned values may contain renderer-owned or injected handles because they represent renderer-side work products, not serialized diagnostics.
- `renderPassAssemblySmokeReportToJsonValue` is the safe inspection surface for render-pass assembly output.
- `summarizeRenderPassAssemblyDiagnosticsBySection` groups render-pass assembly diagnostics by draw list, resources, commands, and execution.

Frame-boundary assembly derived helpers:

- `createFrameExecutionReport` starts from a frame-boundary assembly report and derives the execution-side readiness chain.
- `runInjectedFrameExecution` starts from injected context, device, queue, and render-pass commands, then returns both the frame-boundary assembly and derived frame execution report.
- `frameExecutionReportToJsonValue` and `frameExecutionReportToJson` serialize only readiness, section statuses, counts, and diagnostic summaries.
- `summarizeFrameExecutionDiagnosticsBySection` groups execution diagnostics into boundary smoke, clear compatibility, source diagnostic summary, boundary validation, submission smoke, and command-submission metrics sections.

Renderer summary helpers:

- `createRendererFrameSummaryReport` remains summary-only: callers provide renderer assembly, render-pass assembly, frame submission, frame-boundary validation, MVP readiness, and command-submission metrics reports explicitly.
- `createRendererFrameSummaryFromExecutionReport` is the bridge from execution aggregates to renderer summaries. It uses a `FrameExecutionReport` to fill the frame-submission, frame-boundary, MVP readiness, and command-submission parts of the summary.
- `runInjectedRendererFrameSummary` composes the injected frame execution runner with explicit renderer and render-pass assembly reports. It does not query ECS and does not make the renderer authoritative for app state.
- `runInjectedRenderFrame` is the highest-level current runner. It composes renderer assembly, injected render-pass assembly, and injected frame execution into one report chain. Its render-pass and boundary outputs can contain caller-owned injected handles; its `json` output is the safe summary boundary.
- `rendererFrameSummaryReportToJsonValue`, `rendererFrameSummaryReportToJson`, and `summarizeRendererFrameSummaryDiagnosticsBySection` expose summary data for inspection without serializing WebGPU resources or injected objects.
- `rendererAssemblySmokeReportToJsonValue`, `rendererAssemblySmokeReportToJson`, and `summarizeRendererAssemblyDiagnosticsBySection` expose renderer assembly readiness without detailed package payloads or renderer-owned handles.
- `injectedRenderFrameRunnerReportToJsonValue` and `injectedRenderFrameRunnerReportToJson` combine render-pass assembly JSON, frame execution JSON, renderer frame summary JSON, and boundary validity for a full injected frame.
- `summarizeInjectedRenderFrameDiagnosticsByPhase` groups the full injected frame diagnostics by renderer assembly, render-pass assembly, frame execution, and renderer frame summary phases.
- `injectedRenderFrameDrawCommandRunnerReportToJsonValue` and `injectedRenderFrameDrawCommandRunnerReportToJson` add draw-list planning JSON before the full injected frame JSON.
- `summarizeInjectedRenderFrameDrawCommandDiagnosticsByPhase` adds draw-list planning diagnostics before the full injected frame diagnostics.
- `injectedRenderFrameDrawPackageRunnerReportToJsonValue` and `injectedRenderFrameDrawPackageRunnerReportToJson` add descriptor planning JSON before draw-list and full-frame JSON.
- `summarizeInjectedRenderFrameDrawPackageDiagnosticsByPhase` adds descriptor planning diagnostics before draw-list and full-frame diagnostics.
- `injectedRenderFrameRenderWorldPackageRunnerReportToJsonValue` and `injectedRenderFrameRenderWorldPackageRunnerReportToJson` add render-world package planning JSON before descriptor, draw-list, and full-frame JSON.
- `summarizeInjectedRenderFrameRenderWorldPackageDiagnosticsByPhase` adds render-world package planning diagnostics before descriptor, draw-list, and full-frame diagnostics.
- `injectedRenderFrameSnapshotRunnerReportToJsonValue` and `injectedRenderFrameSnapshotRunnerReportToJson` add snapshot apply, resource binding, transform packing, and draw readiness JSON before render-world package, descriptor, draw-list, and full-frame JSON.
- `summarizeInjectedRenderFrameSnapshotDiagnosticsByPhase` groups snapshot apply, resource binding, transform packing, draw readiness, and downstream render-world package diagnostics. It delegates downstream grouping to `summarizeInjectedRenderFrameRenderWorldPackageDiagnosticsByPhase`.

## Inspection Guide

Use the smallest helper that matches the question:

- Render-pass preparation: `renderPassAssemblySmokeReportToJsonValue` for data, `summarizeRenderPassAssemblyDiagnosticsBySection` for why it is not ready.
- Frame-boundary execution: `frameExecutionReportToJsonValue` for data, `summarizeFrameExecutionDiagnosticsBySection` for missing execution, finish, submit, or source diagnostics.
- Renderer assembly: `rendererAssemblySmokeReportToJsonValue` for data, `summarizeRendererAssemblyDiagnosticsBySection` for snapshot, package, resource, or frame issues.
- Renderer frame summary: `rendererFrameSummaryReportToJsonValue` for data, `summarizeRendererFrameSummaryDiagnosticsBySection` for summary sections.
- Full injected frame runner: `injectedRenderFrameRunnerReportToJsonValue` for a JSON-safe cross-phase snapshot, `summarizeInjectedRenderFrameDiagnosticsByPhase` for phase grouping.
- Draw-command injected frame runner: `injectedRenderFrameDrawCommandRunnerReportToJsonValue` for draw-list plus full-frame data, `summarizeInjectedRenderFrameDrawCommandDiagnosticsByPhase` for draw-list plus full-frame phase grouping.
- Draw-package injected frame runner: `injectedRenderFrameDrawPackageRunnerReportToJsonValue` for descriptor plus draw-list plus full-frame data, `summarizeInjectedRenderFrameDrawPackageDiagnosticsByPhase` for descriptor plus downstream phase grouping.
- Render-world package injected frame runner: `injectedRenderFrameRenderWorldPackageRunnerReportToJsonValue` for package plus descriptor plus draw-list plus full-frame data, `summarizeInjectedRenderFrameRenderWorldPackageDiagnosticsByPhase` for package plus downstream phase grouping.
- Snapshot injected frame runner: `injectedRenderFrameSnapshotRunnerReportToJsonValue` for snapshot apply through full-frame data, `summarizeInjectedRenderFrameSnapshotDiagnosticsByPhase` for snapshot apply, binding, transform packing, readiness, and downstream phase grouping.

These JSON and diagnostic helpers are derived inspection surfaces. They do not store ECS/game state, do not become renderer-owned source of truth, and should remain serializable across future worker/main-thread boundaries.

Test-only fixture chain:

- `createInjectedRenderFrameSmokeFixture` delegates to `runInjectedRenderFrame` to provide one end-to-end smoke fixture for runner tests.
- `createDrawPackageRenderFrameFixture` starts from ECS-derived render-world draw packages, creates draw-command descriptors with `createDrawCommandDescriptors`, then delegates to `runInjectedRenderFrameFromDrawCommands`.
- `createRenderWorldPackageFrameFixture` starts from render-world draw readiness and packed transforms, then delegates to `runInjectedRenderFrameFromRenderWorldPackages`.
- `createSnapshotRenderFrameFixture` starts from a render snapshot, updates render-world bindings, then delegates to `runInjectedRenderFrameFromSnapshot`.
- The fixture returns both raw renderer-side runner outputs and JSON summaries so tests can assert handle boundaries explicitly.

## Draw Data Boundaries

The current runner chain has five useful entry points:

- Render snapshots: use `runInjectedRenderFrameFromSnapshot` when the caller has the extracted snapshot and wants the helper to apply it to a `RenderWorld`, update explicit resource bindings, pack transforms, derive readiness, and continue into the renderer-side frame path.
- Render-world draw readiness plus packed transforms: use `runInjectedRenderFrameFromRenderWorldPackages` when render-world state has already been updated and checked for resource bindings, but draw-package planning has not.
- Render-world draw packages: use `runInjectedRenderFrameFromDrawPackages` when render-world packaging has happened but descriptor and draw-list planning have not.
- Draw-command descriptors: use `runInjectedRenderFrameFromDrawCommands` when package-to-command descriptor planning has happened but draw-list planning has not.
- Draw-list records: use `runInjectedRenderFrame` when draw-list planning has already happened.
- Test fixtures such as `createDrawPackageRenderFrameFixture` prove the package-to-descriptor-to-frame path and should delegate to the production draw-package runner.
- Test fixtures such as `createRenderWorldPackageFrameFixture` prove the readiness-to-package-to-descriptor-to-frame path and should delegate to the production render-world package runner.
- Test fixtures such as `createSnapshotRenderFrameFixture` prove the snapshot-to-render-world-to-package-to-frame path and should delegate to the production snapshot runner.

Snapshots are the extracted ECS/render boundary. Render-world draw readiness, packed transforms, render-world draw packages, draw-command descriptors, and draw-list records are render-side products derived from snapshots and render-world state. The snapshot runner applies snapshot data to render-world state, but it still does not query ECS directly and does not make rendering authoritative for gameplay state, transform hierarchy, or entity lifecycle.

## Architecture Boundary

These reports are derived from render extraction and renderer-owned WebGPU preparation. ECS remains the source of truth for entities, components, transforms, and render authoring data.

Renderer-owned GPU state remains on the renderer side:

- GPU devices, contexts, queues, command encoders, pass encoders, command buffers, buffers, textures, bind groups, and pipelines are not stored in ECS components.
- Report JSON helpers expose only serializable booleans, counts, section statuses, stable keys, and diagnostic summaries.
- JSON helpers intentionally omit nested WebGPU objects, command encoders, pass encoders, command buffers, queue/context/device handles, and detailed injected fixture objects.
- Runner helpers may return raw renderer-side work products for tests and orchestration, but those raw values are not the JSON/debug boundary and must not be treated as ECS state.
- Future worker simulation can publish snapshots and diagnostics without sharing arbitrary WebGPU objects or a mutable scene graph.
