# Lit StandardMaterial Proof Point Audit

Date: 2026-05-16

## Scope

This audit reviewed the first lit StandardMaterial proof point after
`task-0561` through `task-0563`:

- direct-lit StandardMaterial WGSL and pipeline descriptors,
- standard material render selection and bind group requirements,
- the `createWebGpuApp` standard material render path,
- the user-facing lit spinning cube browser example and Playwright route.

Reference anchors:

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/research/BEVY_ECS_RENDER_ALIGNMENT.md`
- Bevy material/extraction/render asset preparation patterns under
  `references/bevy`
- local Three.js and PlayCanvas StandardMaterial, shader, render list, and
  pipeline patterns inspected during the implementation tasks

## Findings

### Architecture Invariants

- ECS remains authoritative. The lit spinning cube is authored by spawning ECS
  entities with transform, mesh, material, camera, visibility, render layer,
  light, and spin components.
- Rendering remains derived. The app facade renders from extracted
  `RenderSnapshot` data and `RenderWorld` resource bindings rather than from a
  renderer-owned scene object graph.
- Assets remain handle-based. The example registers a box mesh and
  StandardMaterial through typed asset collections, then stores handles on ECS
  components.
- WebGPU remains isolated to `@aperture-engine/webgpu`. `@aperture-engine/core`
  and `@aperture-engine/runtime` do not import the WebGPU package, and package
  manifests preserve the intended dependency direction.
- No WebGL fallback or three.js-style `Object3D` / scene graph API was added.

### StandardMaterial Scope

- The StandardMaterial shader path is explicitly an MVP direct-light
  metallic/roughness model.
- Supported proof-point inputs are base color, metallic factor, roughness
  factor, emissive factor, ambient lights, and directional lights.
- Texture sampling, normal maps, image-based lighting, and shadows remain
  deferred in shader metadata, proof-point validation, and pipeline diagnostics.

### Render Bridge

- Standard material extraction produces a distinct `standard|...` pipeline key.
- Standard draw-list planning requires group 3 light bind groups and reports
  missing light resources instead of falling back to unlit.
- Mixed unlit/standard draw ordering and pipeline separation are covered by
  targeted tests.
- Standard material group-2 bind groups and group-3 light bind groups are
  renderer-owned WebGPU resources with stable resource keys; JSON-facing status
  omits raw GPU handles.

### Browser Proof Point

- `examples/spinning-cube.js` now uses `createWebGpuApp`, typed asset
  collections, ECS authoring helpers, ambient/directional lights, and
  `SpinSystem`.
- The example avoids direct WebGPU initialization, render-pipeline creation,
  bind group creation, command encoding, and queue submission.
- The Playwright route verifies:
  - successful WebGPU initialization or clear unsupported-WebGPU failure,
  - nonblank rendered pixels,
  - StandardMaterial pipeline/status shape,
  - extracted lights,
  - frame and rotation progress,
  - JSON-safe status diagnostics.

## Follow-Up

The main audit finding is allocation/resource reuse, not ownership drift.

`createWebGpuApp.render()` now proves the standard material path, but it still
prepares pipelines and GPU resources on each successful frame. This mirrors the
existing simple unlit app facade and is acceptable for proof-point examples, but
it does not satisfy the architecture document's steady-state frame hot-path
allocation discipline.

Added backlog follow-up:

- `task-0566 — Reuse WebGPU app prepared resources across frames`

Follow-up completed in the same run after this audit:

- `task-0565 — Add standard material resource inspection records`

The next cleanup task is:

- `task-0566 — Reuse WebGPU app prepared resources across frames`

## Validation

Passed during the audit run:

- `pnpm run check`
- `pnpm exec playwright test test/e2e/spinning-cube.spec.ts`
- `pnpm run format:check`
