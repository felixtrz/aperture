# Generic Material Route Contract Boundary Audit - 2026-05-17

## Scope

Audit `task-0967`, which added the generic queued material prepare route
contract and adapted built-in material queue route adapters to it.

This audit checks whether the new contract preserves the Aperture invariants:
ECS/source assets remain authoritative, render snapshots and queue items stay
key-based, WebGPU resources remain backend-owned, and diagnostics stay JSON-safe
and separate from retained cache summaries.

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/research/GENERIC_MATERIAL_FAMILY_QUEUE_PREPARE_HANDOFF_PLAN_2026_05_17.md`
- `packages/webgpu/src/webgpu/queued-material-prepare-route.ts`
- `packages/webgpu/src/webgpu/queued-material-adapter.ts`
- `packages/webgpu/src/webgpu/built-in-material-queue-adapter.ts`
- `packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts`
- `test/webgpu/queued-material-prepare-route.test.ts`
- `references/bevy/crates/bevy_pbr/src/material.rs`
- `references/bevy/crates/bevy_render/src/render_phase/mod.rs`

## Boundary Findings

### ECS And Source Asset Ownership

The route contract accepts a `MaterialQueueItem` plus a source `MaterialAsset`
for validation. It does not store either one, mutate either one, or make WebGPU
the source of truth for material state. `acceptsMaterial()` is a type guard used
only to reject family/material mismatches before a route is considered valid.

This matches the Architecture rule that source material assets remain
renderer-independent and that WebGPU consumes render/snapshot data rather than
owning gameplay state.

### GPU Resource Ownership

`QueuedMaterialPrepareRouteResult` exposes only:

- `family`
- `materialKey`
- `meshResourceKey`
- `materialResourceKey`
- `pipelineKey`
- `sourceVersion`
- `frame`
- diagnostics

It does not expose buffers, bind groups, textures, samplers, pipelines, command
encoders, devices, or queues. Built-in adapters currently use
`createQueuedMaterialPrepareRouteResult()` to return the keys already present on
the queue item. Actual app frame resource preparation remains in the existing
WebGPU-private helper path.

This preserves the facade/backend split: public and diagnostic surfaces can talk
about stable resource keys, while raw GPU handles remain backend-owned.

### Diagnostics Shape

The helper returns JSON-safe diagnostic objects for missing adapters and
material mismatches, and forwards existing built-in phase/blend diagnostics for
unsupported route cases. Tests cover `JSON.stringify()` round-tripping on the
successful route shell and assert plain-object diagnostics for:

- missing material-family adapter
- material kind mismatch
- unsupported phase
- unsupported transparent blend preset

These diagnostics are current-frame route/readiness diagnostics. They are not
retained backend cache summaries and do not overlap with `resourceReuse`
reporting.

### Package Direction

The new WebGPU file imports renderer-independent `MaterialAsset` and
`MaterialQueueItem` types from `@aperture-engine/render`. No render package code
imports WebGPU, and no simulation package code imports render or WebGPU. This is
consistent with the documented dependency direction.

### Bevy-Aligned Pattern

The adapted pattern is Bevy-like at the conceptual level: material behavior,
queue validation, prepared render-asset keys, and draw execution remain separate
stages. The Aperture implementation stays TypeScript-explicit and JSON-safe
rather than copying Bevy's Rust trait shape.

## Result

`task-0967` stays within the intended boundary. It is a contract and diagnostic
surface, not a resource-preparation rewrite. No architecture or decision record
change is needed.

## Follow-Up

`task-0971` should wire WebGPU app route reporting through
`routeQueuedMaterialPrepare()` before built-in family resource preparation. That
slice should keep successful frame output unchanged and should still return
prepared resource keys instead of raw GPU handles.
