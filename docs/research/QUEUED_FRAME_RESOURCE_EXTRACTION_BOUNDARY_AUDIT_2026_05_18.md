# Queued Frame-Resource Extraction Boundary Audit

Date: 2026-05-18

## Scope

Audit the `queued-built-in-frame-resource-set` split after task-1127. The goal
was to verify that the extracted frame-resource preparation module remains a
derived WebGPU/render-frame helper, not a new app facade, ECS reader, canvas
owner, or renderer-authoritative state store.

## References Inspected

- `docs/research/GENERIC_MATERIAL_FAMILY_FRAME_RESOURCE_COLLECTOR_SPLIT_PLAN_2026_05_17.md`
- `docs/ARCHITECTURE.md`
- `packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`
- `packages/webgpu/src/webgpu/queued-built-in-frame-resource-set.ts`
- `packages/webgpu/src/webgpu/app.ts`
- `test/webgpu/queued-built-in-frame-resource-set.test.ts`

## Findings

The extracted module has the intended ownership shape:

- It does not import or accept `WebGpuApp`, `EcsWorld`, `AssetRegistry`, canvas,
  context, queue, device, browser globals, or `RenderWorld`.
- It consumes a `QueuedBuiltInAppResourceSet`, packed view uniforms, packed
  world transforms, reusable scratch, and injected callbacks.
- Pipeline lookup, pipeline layout derivation, texture/sampler preparation, and
  concrete frame-resource option creation remain injected from `app.ts`.
- GPU submission, canvas sizing, readback assembly, and command-boundary
  assembly remain in `app.ts`.
- The scratch reset path clears maps and arrays in place, including
  pipeline-scoped bind-group scratch and per-family resource buckets.
- Frame-resource route diagnostics use route shells with family, status,
  backend resource keys, and diagnostics, rather than raw GPU handles.

One small correction was made during the audit: the frame-resource preparation
options accepted a `snapshot` value that the extracted module did not read. That
input was removed from the module, app caller, and targeted tests so the API
only requests the data it actually needs.

## Boundary Assessment

The split preserves the architecture documented in `docs/ARCHITECTURE.md`:
ECS remains authoritative, render snapshots and prepared assets are inputs to
renderer-owned preparation, and WebGPU resources stay behind the backend/app
boundary. The module is still built around built-in material families, so it is
not yet the generic material-family adapter interface. That is already covered
by `task-1143`.

## Follow-Ups

- Continue with `task-1143` to design the generic material-family frame-resource
  adapter interface.
- No additional corrective backlog item was added from this audit.
