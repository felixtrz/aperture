# Frame Resource Route Shell App Diagnostics Boundary Audit - 2026-05-17

## Scope

Audit `task-0978`, which added failure-only
`webGpuApp.frameResourceRoute` diagnostics for queued built-in frame resource
preparation failures.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/research/FRAME_RESOURCE_ROUTE_SHELL_APP_INTEGRATION_PLAN_2026_05_17.md`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/queued-material-frame-resource-route.ts`
- `test/webgpu/webgpu-app.test.ts`
- `test/webgpu/queued-material-frame-resource-route.test.ts`
- `references/bevy/crates/bevy_render/src/render_phase/mod.rs`

## Findings

### Failure Diagnostic Shape

The new diagnostic is emitted only when `adapter.createFrameResources()` fails
inside `prepareQueuedBuiltInFrameResources()`. It includes a
`QueuedMaterialFrameResourceRouteShell` with:

- route validity/status
- material family
- facade mesh/material resource keys
- backend mesh/material source-version keys
- pipeline key
- source version
- frame
- frame-resource diagnostics

It does not include the `resources` object returned by frame resource helpers,
so raw GPU handles are not copied into app diagnostics.

### Successful Frame Behavior

Successful queued built-in frame preparation still appends the same family
resources and bind groups as before. The targeted mixed-family app route
regression continues to pass with unchanged reuse expectations after the
failure-only diagnostic was added.

### Cache Summary Separation

The diagnostic is pushed into current-frame diagnostics only on failure. It does
not modify `resourceReuse`, retained prepared mesh/material cache summaries, or
texture/sampler cache summaries.

### Open Reporting Policy

Successful-frame route shell reporting remains intentionally undecided. Emitting
shells on every successful frame could be useful for debugging but would add a
new report surface and possible allocation pressure. That decision should be
planned separately before changing the successful-frame report shape.

## Result

`task-0978` stays within the intended boundary. It improves failed preparation
diagnostics without changing successful frame output, backend resource
ownership, or retained cache reports.

## Follow-Up

`task-0980` should decide the successful-frame route shell policy: keep omitted,
add an optional diagnostics flag, or add a stable report field with explicit
allocation/report-shape tradeoffs.
