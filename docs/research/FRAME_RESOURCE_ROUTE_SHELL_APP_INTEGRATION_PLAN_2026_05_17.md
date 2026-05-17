# Frame Resource Route Shell App Integration Plan - 2026-05-17

## Goal

Define where `createQueuedMaterialFrameResourceRouteShell()` should be used in
the WebGPU app without changing successful frame output, draw counts, or cache
reuse behavior.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/research/GENERIC_FRAME_RESOURCE_ROUTE_SHELL_BOUNDARY_AUDIT_2026_05_17.md`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/queued-material-frame-resource-route.ts`
- `packages/webgpu/src/webgpu/queued-material-prepare-route.ts`
- `test/webgpu/webgpu-app.test.ts`
- `references/bevy/crates/bevy_render/src/render_phase/mod.rs`

## Proposed Integration Point

Use the shell in `prepareQueuedBuiltInFrameResources()` immediately after each
family adapter returns from `createFrameResources()`.

That point has all required inputs:

- the route/queue item
- source-version backend mesh/material keys from `QueuedBuiltInAppResourceItem`
- the frame resource result validity and diagnostics
- the snapshot frame and pipeline key

The initial integration should only collect shells into app-local diagnostics or
a debug/report field when frame resource preparation fails. Do not attach the
shell to successful render reports yet unless a stable report surface is added.

## Key Preservation Rule

When constructing the shell:

- `facadeMeshResourceKey` and `facadeMaterialResourceKey` come from the
  `MaterialQueueItem` / prepare route result.
- `backendMeshKey` and `backendMaterialKey` come from the existing
  `QueuedBuiltInAppResourceItem.meshKey` and `.materialKey` values, which are
  source-version backend preparation keys.

Do not substitute one family for the other.

## First Implementation Slice

`task-0978` should:

1. Create the frame-resource route shell after `adapter.createFrameResources()`.
2. Include the shell only in failure diagnostics/reporting, where the app
   already emits preparation diagnostics.
3. Add targeted tests proving JSON output includes both key families and omits
   raw GPU handle markers.
4. Re-run the existing successful mixed-family route tests to prove reuse counts
   remain unchanged.

## Non-Goals

- Do not add a public stable diagnostics field for successful frames yet.
- Do not move all frame resource helper calls behind a new abstraction.
- Do not change `resourceReuse` or retained backend cache summaries.
- Do not change app-facing route diagnostic codes.

## Follow-Up

After `task-0978`, audit the integration if it changes report shape or app
diagnostic output. If the failure-only shell proves useful, a later task can
consider a stable optional diagnostics surface for successful frames.
