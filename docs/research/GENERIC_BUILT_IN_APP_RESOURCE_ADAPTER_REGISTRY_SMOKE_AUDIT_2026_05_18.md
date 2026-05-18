# Generic Built-In App Resource Adapter Registry Smoke Audit — 2026-05-18

## Scope

Audited `task-1416`, which added narrow registry metadata and smoke coverage for
the active built-in app resource adapter families.

Reference anchors:

- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts`
- `packages/webgpu/src/webgpu/built-in-material-queue-adapter.ts`
- `packages/webgpu/src/webgpu/queued-material-frame-resource-route.ts`

## Findings

- The implementation did not broaden into a route rewrite. It extracted active
  built-in app resource adapter family metadata and a registration factory while
  preserving the existing registry creation behavior.
- The tests cover the active built-in families: Unlit, Matcap, Standard, and
  DebugNormal. They prove the family keys are unique and that every registration
  exposes the expected route, texture/sampler preparation, frame-resource
  creation, and append functions.
- ECS authority is unchanged. The registry only describes WebGPU app adapter
  routing after render extraction.
- Render extraction boundaries remain intact. The adapter registrations still
  consume queued material/resource inputs rather than source ECS state.
- JSON-safe diagnostics remain intact because no report shape was broadened to
  include resources or GPU handles.
- WebGPU-only ownership is unchanged; no WebGL fallback or renderer-owned
  source/game state was introduced.

## Recommendation

Proceed with `task-1418`: update tracker/backlog alignment for the adapter
registry smoke coverage, then continue to the next material route or
StandardMaterial planning slice.
