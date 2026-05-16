# Post-Proof-Point Boundary Audit

Date: 2026-05-16

## Scope

This audit reviewed the proof-point follow-up work after the lit
StandardMaterial spinning cube:

- WebGPU app resource reuse across unchanged frames.
- Named render-frame phase helpers.
- Scratch-backed view-uniform packing.
- Packed-light shader metadata and JSON helpers.
- Package-boundary and public documentation drift.

Reference anchors:

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- Bevy render asset, render schedule, and phase queue/sort patterns inspected
  during the preceding implementation run.

## Findings

### Package Boundaries

`@aperture-engine/core`, `@aperture-engine/runtime`,
`@aperture-engine/render`, and `@aperture-engine/simulation` remain headless
with respect to backend ownership. Their package manifests do not depend on
`@aperture-engine/webgpu`, and source search found no WebGPU package imports in
those packages.

The only headless reference to WebGPU is the identity string
`renderingBackend: "webgpu-explicit"` in `@aperture-engine/core`, which records
the architecture contract rather than importing the backend.

### App Resource Reuse

`createWebGpuApp` now owns a private WebGPU-side resource cache for pipelines,
pipeline layouts, and the current unlit or standard frame resource set. The
cache keys source mesh/material handles by stable asset handle plus source
asset version, then reuses renderer-owned GPU resources when byte sizes and
source versions still match.

This does not make WebGPU authoritative for ECS or source assets:

- ECS state is still updated through `app.world`, systems, and transform
  resolution.
- Rendering still starts from `extractRenderSnapshot(...)`.
- Source assets still live in `AssetRegistry`.
- Cached frame entries store renderer-owned resource results and compact
  version keys, not mutable ECS components or source asset records.
- Reused dynamic state is pushed through `queue.writeBuffer` into existing
  buffers.

The cache remains intentionally narrow. It is a proof-point app-facade cache,
not a full multi-asset render-world cache. Backlog follow-ups `task-0568`,
`task-0569`, and `task-0571` are still appropriate.

### Render-Frame Phases

The render-frame phase helpers keep the frame boundary explicit:

1. `extract`
2. `asset-change-collection`
3. `prepare`
4. `queue`
5. `sort`
6. `submit`

The queue helper writes unsorted records into caller-owned scratch state, and
the sort helper mutates that queue in place. This matches the architecture
direction: extraction, preparation, queueing, sorting, and submission remain
separate concepts instead of becoming a hidden renderer scene graph.

### View Uniform Scratch Packing

`writePackedSnapshotViewUniforms(...)` reuses its result shell, view records,
diagnostic array, duplicate-id set, and backing `Float32Array` when capacity is
sufficient. Capacity growth is still allowed when a larger view set appears,
which is acceptable as a resize path rather than steady-state allocation.

The existing allocation-friendly `packSnapshotViewUniforms(...)` remains useful
for tests, diagnostics, and one-shot callers. The app facade does not yet use
the scratch writer, which is tracked by `task-0568`.

### Light Shader Metadata

The packed-light shader metadata remains an inspection surface. JSON helpers
serialize:

- binding ids, groups, and binding numbers,
- storage binding element types,
- packed-light strides,
- WGSL declaration text,
- readiness sections and diagnostics.

They do not serialize raw `GPUBuffer`, `GPUBindGroupLayout`, `GPUBindGroup`,
shader module, pipeline, device, or queue handles. The metadata-only unlit
shader variant records future group-3 light binding requirements without
changing active unlit rendering.

The active StandardMaterial proof path consumes packed light buffers for
ambient and directional direct lighting. Texture lighting, IBL, skybox
consumption, and shadow maps remain deferred renderer-owned work.

### Corrective Fix

The README still described the repository as a minimal identity-only foundation
and the spinning cube as textured unlit. That was stale after the proof point.

Corrective fix made:

- Updated `README.md` to describe the current early engine foundation,
  explicit WebGPU package, and lit StandardMaterial spinning cube example.

## Result

No ownership drift was found in the implementation. The current state preserves
the core architecture:

- ECS is authoritative.
- Rendering is derived from extracted snapshots.
- WebGPU owns GPU resources only.
- Headless packages remain backend-independent.
- JSON diagnostics omit raw GPU handles.
- Frame phases stay inspectable and separately named.

## Recommended Next Work

1. `task-0568` — add a reusable WebGPU app frame scratch object for packing and
   planning.
2. `task-0569` — add a scratch-backed app resource binding planner.
3. `task-0571` — expose app-facade resource reuse diagnostics.
4. `task-0570` — add the renderer-independent MatcapMaterial source asset
   contract after the frame-loop cleanup.

## Validation

Validation before this audit note:

- `pnpm run check`
- `pnpm exec playwright test test/e2e/spinning-cube.spec.ts`

Validation after the README and audit-note fix should at minimum run:

- `pnpm run format:check`
- `pnpm run check`
