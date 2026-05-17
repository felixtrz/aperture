# Frame-Resource Route Summary Consumer Plan

Date: 2026-05-17

Task: `task-1046`

## Goal

Decide whether
`createQueuedMaterialFrameResourceRouteShellSummary()` needs an example or app
diagnostics consumer now.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/DIAGNOSTICS_SUMMARIES.md`
- `docs/research/SUCCESSFUL_FRAME_ROUTE_SHELL_REPORTING_POLICY_PLAN_2026_05_17.md`
- `docs/research/SUCCESSFUL_FRAME_ROUTE_SHELL_POLICY_BOUNDARY_AUDIT_2026_05_17.md`
- `docs/research/NEXT_GENERIC_MATERIAL_ROUTE_CONTRACT_SLICE_PLAN_2026_05_17.md`
- `docs/research/FRAME_RESOURCE_ROUTE_SHELL_SUMMARY_BOUNDARY_AUDIT_2026_05_17.md`
- `packages/webgpu/src/webgpu/queued-material-frame-resource-route.ts`
- `packages/webgpu/src/webgpu/app.ts`
- `examples/app-diagnostics.js`
- `test/webgpu/queued-material-frame-resource-route.test.ts`
- `test/webgpu/webgpu-app.test.ts`

## Decision

Keep the new route shell summary helper helper-only for now. Do not add an app
report field or diagnostics example consumer in this slice.

The existing app path already emits detailed
`webGpuApp.frameResourceRoute` diagnostics when frame-resource preparation
fails. Successful frames intentionally omit route shell data by default, and the
new summary helper does not change that policy. A diagnostics example consumer
would currently need to synthesize or expose successful route shells that the
app deliberately does not publish.

## Rationale

- Failure cases already carry the actionable route shell in
  `webGpuApp.frameResourceRoute`; summarizing that same diagnostic in the app
  example would add little signal.
- Successful route summaries would create a new successful-frame report surface
  before a concrete debugging workflow needs it.
- `examples/app-diagnostics.js` already demonstrates opt-in summaries for
  material dependencies, texture fidelity, sampler fidelity, prepared facade
  state, and prepared/backend lifetime alignment. Adding route summary output
  without a real app report source would make the example less representative.
- The current helper tests prove the intended boundary: compact status/key
  presence/pipeline facts and diagnostic code counts without facade keys,
  backend keys, raw diagnostic messages, resource keys, or GPU handles.

## Follow-Up

No implementation consumer should be added now. Use `task-1047` to audit this
deferral against the route summary boundary and then continue with
`task-1048`, which plans the render-world prepared summary consumer shape.

If a later debugging workflow needs successful frame-resource route summaries,
add a focused optional diagnostics flag task with report-shape and allocation
tests. That task should keep successful app reports unchanged unless the flag is
explicitly enabled.
