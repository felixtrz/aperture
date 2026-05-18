# Next Route Or Standard After Registry Validation Plan Audit

Date: 2026-05-18

Task: `task-1662`

## Scope

Audit the `task-1661` plan selecting a non-built-in prepared-resource route
shell regression.

Reference files inspected:

- `docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_REGISTRY_VALIDATION_PLAN_2026_05_18.md`
- `docs/research/NON_BUILT_IN_APP_MATERIAL_ADAPTER_DECOMPOSITION_2026_05_18.md`
- `docs/research/GENERIC_APP_ADAPTER_REGISTRY_VALIDATION_HELPER_AUDIT_2026_05_18.md`
- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `packages/webgpu/src/webgpu/queued-material-frame-resource-route.ts`
- `test/webgpu/queued-material-generic-app-adapter-contract.test.ts`
- `test/webgpu/queued-material-frame-resource-route.test.ts`

## Findings

- The selected follow-up is concrete enough for one focused run. It is scoped to
  route-shell metadata tests and does not require production WebGPU resource
  creation.
- The selected test directly advances the ordered non-built-in decomposition by
  proving arbitrary family route metadata can carry facade and backend
  prepared-resource keys without drawing.
- The task preserves ECS authority because it uses queue/route fixtures only and
  does not introduce ECS-owned GPU state or a scene graph.
- The task preserves render extraction boundaries because it consumes existing
  queue and route result shapes rather than querying ECS or mutating renderer
  state.
- The task preserves WebGPU-only backend ownership because it asserts raw GPU
  handles are omitted and does not initialize a device, shader, bind group,
  pipeline, example, or browser fixture.
- The task does not expose public custom material source authoring and does not
  require a new decision record.

## Recommendation

Implement `task-1663` as planned. If the regression exposes no production gap,
keep the change test-only and follow it with a small tracker/backlog alignment
or implementation audit.
