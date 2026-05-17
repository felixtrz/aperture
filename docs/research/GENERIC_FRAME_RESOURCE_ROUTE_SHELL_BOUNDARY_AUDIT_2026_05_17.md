# Generic Frame Resource Route Shell Boundary Audit - 2026-05-17

## Scope

Audit `task-0975`, which added
`createQueuedMaterialFrameResourceRouteShell()` and tests for the next generic
frame-resource adapter migration slice.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/research/GENERIC_APP_FRAME_RESOURCE_ADAPTER_MIGRATION_PLAN_2026_05_17.md`
- `packages/webgpu/src/webgpu/queued-material-frame-resource-route.ts`
- `packages/webgpu/src/webgpu/queued-material-prepare-route.ts`
- `packages/webgpu/src/webgpu/app.ts`
- `test/webgpu/queued-material-frame-resource-route.test.ts`
- `references/bevy/crates/bevy_pbr/src/material.rs`
- `references/bevy/crates/bevy_render/src/render_phase/mod.rs`

## Findings

### Shell Ownership

The new shell is a reporting structure only. It accepts a prepare route result,
backend mesh/material keys, and a frame-resource result-like object containing
`valid` and `diagnostics`. It does not retain, expose, or serialize the actual
frame resources.

This keeps raw WebGPU handles inside the backend resource preparation path.

### Key Boundary

The shell intentionally records both key families:

- `facadeMeshResourceKey` / `facadeMaterialResourceKey` from the prepare route
  result.
- `backendMeshKey` / `backendMaterialKey` from source-version backend
  preparation inputs.

Tests prove these values remain distinct and that JSON output does not contain
fake raw GPU handle markers from the resource result object.

### Diagnostics

The shell forwards frame-resource diagnostics as current-frame preparation
diagnostics. It does not write to retained cache summaries or `resourceReuse`.
Any future app integration should keep those surfaces separate.

### Package Boundary

The helper lives in `@aperture-engine/webgpu` and imports only the route result
type from the neighboring WebGPU route contract. No renderer-independent package
imports WebGPU.

## Result

`task-0975` stays within the intended architecture boundary. It creates a
JSON-safe shell that can support future app integration without moving GPU
resource ownership or changing backend cache key semantics.

## Follow-Up

`task-0977` should plan where this shell should be emitted or consumed in the
WebGPU app frame preparation path. That plan should keep successful frame output
and cache reuse expectations unchanged before any wiring patch lands.
