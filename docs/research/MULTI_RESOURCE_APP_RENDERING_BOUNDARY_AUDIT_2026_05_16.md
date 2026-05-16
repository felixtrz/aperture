# Multi-Resource App Rendering Boundary Audit

Date: 2026-05-16

## Scope

Audited the `createWebGpuApp` multi-resource app rendering path after
same-family unlit and mixed unlit/Matcap app-frame support landed.

Focus areas:

- package dependency direction
- ECS/render ownership of source handles and serializable data
- WebGPU ownership of prepared resources
- draw resource-set planning and material resource-key routing
- app report JSON safety
- follow-up backlog alignment

## Reference Anchors

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `references/bevy/crates/bevy_render/src/render_asset.rs`
- `references/bevy/crates/bevy_pbr/src/material.rs`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/render-frame-plan.ts`
- `packages/webgpu/src/webgpu/render-pass-draw-list.ts`

The Bevy anchor remains the same conceptual split: source assets are extracted
and prepared into renderer-side assets, material instances route to prepared
material bind groups, and specialization/queueing uses material and pipeline
keys instead of making the renderer own game state.

## Findings

- `packages/simulation`, `packages/render`, and `packages/runtime` do not import
  `@aperture-engine/webgpu` or browser/WebGPU APIs.
- Source texture `sourceData` remains renderer-independent bytes plus row-layout
  metadata. `GPUQueue.writeTexture` use stays in `packages/webgpu`.
- Mixed unlit/Matcap app rendering keeps ECS authoritative: renderables still
  enter the backend as `RenderSnapshot` mesh/material handles, and app routing
  derives GPU resources from typed asset collections.
- The app facade now passes both unlit and Matcap pipeline resources into
  render-frame planning. Material bind group resolution remains per draw via the
  material resource key, matching the existing render-world binding contract.
- App report JSON remains safe. Raw snapshots, command buffers, bind groups,
  buffers, textures, and pipeline handles are still omitted by
  `webGpuAppRenderReportToJsonValue()`.
- Material dependency diagnostics now block whole-frame app submission when any
  snapshot material dependency diagnostic is present. This avoids partial frame
  submission when a mixed frame has one ready material and one blocked material.

## Limitations Kept In Scope

- Mixed unlit/Matcap support is intentionally narrow: shared mesh, factor-only
  unlit material, and one Matcap material.
- StandardMaterial cannot yet participate in mixed-family app frames.
- The material showcase is still a direct WebGPU proof/demo until the app facade
  can render all three built-in material families together.

## Follow-Ups

- `task-0602` should add StandardMaterial to mixed-family app rendering.
- `task-0603` should add browser diagnostics coverage for mixed-family success
  and dependency-failure reports.
- `task-0583` should promote the material showcase after StandardMaterial can
  route through the same app-facing multi-family path.
