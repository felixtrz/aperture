# Prepared Material Facade Snapshot And Queue Helper Audit - 2026-05-17

## Scope

Audit the renderer-independent prepared material facade helpers added after the
render-world binding plan:

- `prepareSnapshotMaterials`
- `createPreparedMaterialQueueResourceKeyResolver`
- `prepareAndBindSnapshotMaterialsToRenderWorld`
- `preparedMaterialStoreSummaryToJsonValue`

The goal is to verify these helpers do not blur source asset ownership,
`RenderSnapshot` immutability, render-world state, or WebGPU backend ownership.

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/RENDER_ASSET_PREPARATION.md`
- `packages/render/src/assets/preparation.ts`
- `packages/render/src/rendering/snapshot-prepared-materials.ts`
- `packages/render/src/rendering/prepared-material-queue-resolver.ts`
- `packages/render/src/rendering/render-world-prepared-materials.ts`
- `packages/render/src/rendering/material-queue.ts`
- `packages/webgpu/src/webgpu/prepared-built-in-material-store.ts`
- `references/bevy/crates/bevy_render/src/render_asset.rs`

## Findings

### Source Asset Authority

No drift found.

- `prepareSnapshotMaterials` reads material handles from `RenderSnapshot` and
  prepares facade metadata through `PreparedMaterialStore`.
- Source material assets remain in `AssetRegistry`; prepared facade entries
  contain descriptor metadata and source versions, not source material objects.
- Missing, loading, or failed source material states are reported through
  preparation outcomes and diagnostics rather than renderer fallback state.

### Snapshot Immutability

No drift found.

- None of the new helpers writes to `RenderSnapshot`.
- Tests assert snapshot draw packets do not gain resource binding fields.
- The combined helper applies a snapshot to `RenderWorld` and then prepares/
  binds derived material keys, preserving the snapshot as the worker-friendly
  input boundary.

### Render-World Ownership

No drift found.

- `bindPreparedMaterialResourcesToRenderWorld` stores only logical string
  material resource keys on `RenderWorldObject.gpu.materialResourceKey`.
- Missing facade entries clear stale material keys so draw readiness remains
  blocked instead of silently using old material resources.
- The combined helper preserves mesh bindings and leaves mesh resource
  preparation outside this slice.

### WebGPU Boundary

No drift found.

- New helpers are under `@aperture-engine/render` and do not import
  `@aperture-engine/webgpu`.
- `PreparedMaterialStore` entries contain logical material/bind-group resource
  keys and dependency metadata only.
- WebGPU-private material buffers, bind groups, textures, samplers, light
  resources, and cache maps remain under `@aperture-engine/webgpu`.

### Diagnostics And JSON Safety

No drift found.

- Snapshot preparation reports convert render-asset preparation diagnostics into
  `RenderDiagnostic` entries with material keys and outcomes.
- The material queue resolver returns `null` for missing facade entries and lets
  `material-queue.ts` produce the existing JSON-safe missing-resource
  diagnostic.
- The prepared material store summary omits source asset objects, raw backend
  handles, and internal maps.

## Decision

The prepared material facade helpers are aligned with Aperture's architecture:
ECS/source assets remain authoritative, rendering consumes derived snapshot and
prepared metadata, and WebGPU resources remain backend-owned.

## Follow-Ups

- Add a WebGPU app prepared material facade summary only after the app route
  prepares facade entries in addition to its existing backend cache resources.
- Keep the backend prepared material cache summary separate from the facade
  summary.
- Continue with a focused WebGPU app handoff task before any broader material
  queue refactor.
