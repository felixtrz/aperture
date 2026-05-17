# App Frame Resource Hot-Path Allocation Plan - 2026-05-17

## Scope

Plan the next cleanup slices for allocation that remains after extracting the
app-local unlit, Matcap, and StandardMaterial frame-resource helpers.

This is a planning slice only. It does not change implementation.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/research/FRAME_RESOURCE_REUSE_HELPER_EXTRACTION_PLAN_2026_05_17.md`
- `docs/research/APP_FRAME_RESOURCE_SHARED_UTILITIES_BOUNDARY_AUDIT_2026_05_17.md`
- `packages/webgpu/src/webgpu/unlit-app-frame-resources.ts`
- `packages/webgpu/src/webgpu/matcap-app-frame-resources.ts`
- `packages/webgpu/src/webgpu/standard-app-frame-resources.ts`
- `packages/webgpu/src/webgpu/app-frame-resource-utils.ts`
- `packages/webgpu/src/webgpu/view-uniform-buffer.ts`
- `packages/webgpu/src/webgpu/world-transform-buffer.ts`
- `packages/webgpu/src/webgpu/light-packing.ts`
- `references/three.js/src/renderers/webgl/WebGLRenderLists.js`
- `references/engine/src/scene/layer.js`

## Reference Pattern

The useful commonality is stable caller-owned frame storage:

- three.js reuses render-item records by index and clears only active phase
  lists per frame;
- PlayCanvas keeps visible opaque/transparent lists attached to a layer and
  sorts/updates them in place.

Aperture should adapt this as typed scratch/result shells owned by the app or
render-world frame cache. The cleanup should not add global caches, mutable
scene nodes, or renderer-owned ECS state.

## Remaining Allocation Sources

### Reused-resource success path

These allocations still happen when a cache slot hits:

- `createViewUniformBufferDescriptor` creates a result object, a plan object,
  a descriptor object, and a diagnostics array.
- `createWorldTransformBufferDescriptor` creates the same result/plan/
  descriptor/diagnostics shape for transform buffers.
- `createOrReuseUnlitAppFrameResources` and
  `createOrReuseMatcapAppFrameResources` create fresh success result wrappers
  and fresh nested `resources`, `viewUniform`, and `worldTransforms` records
  before replacing the cached result.
- `createOrReuseStandardAppFrameResources` does the same and also creates a
  fresh `lightGpuBuffers` wrapper.
- StandardMaterial reuse calls `createLightBufferDescriptor`, which currently
  repacks lights into new `Float32Array` and `Int32Array` instances, then calls
  `createLightBufferDescriptorPlan`, which creates plan/descriptor/result
  wrappers.

These are the highest-priority cleanup targets because they occur in the
steady-state second-frame path.

### Setup and cache-miss path

These allocations are acceptable for now because they happen during first use,
resource key changes, or asset dependency changes:

- full mesh/material/light GPU buffer creation;
- bind group creation;
- texture and sampler GPU resource creation;
- pipeline/layout creation;
- copying texture and sampler dependency key arrays into cache slots.

The cache-slot key copies are worth revisiting, but they should be treated as a
cache-miss cleanup, not as the first hot-path target.

### Adjacent queue assembly

The app route scratch already reuses maps and arrays, but
`pipelineScopedBindGroups` still maps shared bind groups into fresh scoped
records each frame. This is adjacent to frame-resource reuse rather than inside
the per-family helper modules, so it should be handled in a separate route
scratch slice.

## Recommended Cleanup Order

1. Add scratch-backed descriptor writers for view uniforms and world
   transforms.
   - Keep existing `create*Descriptor` helpers as convenience wrappers.
   - The app frame-resource helpers should receive or own descriptor scratch and
     call `write*Descriptor`.
   - Tests should prove result/plan/descriptor identity reuse on repeated
     successful writes.

2. Add a StandardMaterial light packing scratch writer.
   - Reuse typed arrays when light counts and strides fit.
   - Reuse descriptor-plan/result shells.
   - Keep `packLightPackets` and `createLightBufferDescriptor` as
     allocation-friendly one-shot helpers for tests/setup.

3. Give each app frame-resource cache slot a reusable success result shell.
   - Cache slots can own mutable wrappers for `resources`, `viewUniform`,
     `worldTransforms`, and Standard `lightGpuBuffers`.
   - Cache-hit paths should update shell fields in place instead of spreading
     nested records into fresh objects.
   - Public result shapes can remain readonly at the type boundary.

4. Reuse scoped bind group records in queued app route scratch.
   - Replace per-frame `map` allocation in `pipelineScopedBindGroups` with a
     scratch-backed writer.
   - Keep pipeline key scoping behavior unchanged.

5. Revisit cache-miss key-list storage.
   - Avoid `[...textureKeys]` and `[...samplerKeys]` only after the success path
     is stable.
   - Prefer cache-owned mutable arrays that copy keys in place on miss.

## Proposed Follow-Up Tasks

### Add app descriptor-plan scratch writers

Category: `webgpu-render`
Package/write-scope: `packages/webgpu/src/webgpu`, targeted tests.
Reference anchor: existing transform/view descriptor helpers, extracted app
frame-resource helpers, and the three.js render-list record reuse pattern.

Acceptance criteria:

- View uniform and world transform descriptor planning have scratch-backed
  writer APIs.
- Existing create helpers remain as convenience wrappers.
- Tests prove result/plan/descriptor object identity is reused across repeated
  successful writes.

### Add Standard light-pack scratch writer

Category: `webgpu-render`
Package/write-scope: `packages/webgpu/src/webgpu/light-packing.ts`, targeted
tests.
Reference anchor: Standard app frame-resource helper and existing transform
packing scratch APIs.

Acceptance criteria:

- Light packet packing can reuse caller-owned typed arrays when capacity fits.
- Light descriptor planning can reuse result/descriptor shells.
- Existing one-shot helpers remain available for tests and setup.

### Reuse app frame-resource success result shells

Category: `webgpu-render`
Package/write-scope: extracted app frame-resource helper modules and focused
WebGPU app tests.
Reference anchor: this allocation plan and existing cache-slot reuse tests.

Acceptance criteria:

- Unlit, Matcap, and Standard cache-hit paths update cached result shells in
  place.
- Second-frame app tests still prove resource reuse counters and dynamic buffer
  write counts.
- Public app report shapes remain JSON-safe and do not expose mutable scratch
  as API.

## Non-Goals

- Do not merge family-specific frame-resource helpers back into `app.ts`.
- Do not introduce a public material plugin API.
- Do not move source asset ownership into WebGPU resources.
- Do not hide frame state in module globals.
- Do not change pipeline keys, supported material families, or route
  diagnostics as part of allocation cleanup.
