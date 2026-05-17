# Generic Frame Resource Success Path Plan Boundary Audit - 2026-05-17

## Scope

Audit the generic frame-resource success-path migration plan.

This audit checks whether the proposed follow-up stays inside app frame-resource
routing, preserves backend/facade key boundaries, and avoids public successful
report changes.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/research/GENERIC_FRAME_RESOURCE_SUCCESS_PATH_MIGRATION_PLAN_2026_05_17.md`
- `docs/research/SUCCESSFUL_FRAME_ROUTE_SHELL_REPORTING_POLICY_PLAN_2026_05_17.md`
- `docs/research/SUCCESSFUL_FRAME_ROUTE_SHELL_POLICY_BOUNDARY_AUDIT_2026_05_17.md`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/queued-material-frame-resource-route.ts`
- `packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts`
- `references/bevy/crates/bevy_render/src/render_phase/mod.rs`

## Findings

The plan is boundary-safe:

- It preserves the current public app report shape for successful frames.
- It keeps successful route shells internal by default, matching the earlier
  successful-shell reporting policy.
- It explicitly preserves the facade queue key versus backend source-version key
  split.
- It reuses existing family-specific frame-resource helpers instead of replacing
  unlit, Matcap, and Standard preparation in one broad refactor.
- It does not change shader selection, bind group layouts, pipeline creation,
  texture/sampler preparation, retained cache summaries, draw submission, IBL,
  shadows, or render graph architecture.

## Architecture Check

The proposed implementation remains inside the WebGPU backend/app facade and
continues to consume render snapshots plus renderer-owned prepared resources.
It does not make ECS state renderer-owned, does not require the renderer to
query ECS, and does not introduce a scene graph.

The plan is compatible with the no-steady-state allocation decision only if the
implementation writes any successful shell data into caller-owned scratch or
omits it entirely from valid frames. The current recommendation to keep
successful shells out of public reports should remain mandatory for the first
implementation slice.

## Follow-Up Wording

The implementation follow-up should be explicit:

- wrap the existing per-family `adapter.createFrameResources()` result through
  the frame-resource shell internally;
- continue exposing shells only through existing failure diagnostics;
- prove successful mixed-family app output and cache reuse are unchanged.

No additional decision record is required.
