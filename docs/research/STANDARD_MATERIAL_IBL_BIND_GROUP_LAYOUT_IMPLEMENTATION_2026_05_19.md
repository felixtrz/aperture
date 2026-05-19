# StandardMaterial IBL Bind-Group Layout Implementation — 2026-05-19

## Task

Implemented `task-1837`: add descriptor-only StandardMaterial IBL bind-group
layout metadata.

## Reference Anchors

- `packages/webgpu/src/webgpu/standard-bind-group-layout.ts`
- `packages/webgpu/src/webgpu/standard-bind-group.ts`
- `packages/webgpu/src/webgpu/standard-material-ibl-shadow-binding-readiness.ts`
- `docs/research/STANDARD_MATERIAL_IBL_BIND_GROUP_LAYOUT_SLICE_PLAN_2026_05_19.md`
- `references/engine/src/scene/shader-lib/wgsl/chunks/lit/frag/lighting/shadowPCF3.js`
- `references/three.js/src/renderers/shaders/ShaderChunk`

## Implementation

Added `StandardMaterialIblBindGroupLayoutReadinessReport` in
`packages/webgpu`. The descriptor-only layout uses group 4 for renderer
environment inputs, leaving existing groups unchanged:

- group 0: view;
- group 1: world transforms;
- group 2: per-material StandardMaterial resources;
- group 3: lights;
- group 4: StandardMaterial IBL resources.

The new group 4 layout currently declares:

- binding 0: diffuse irradiance texture view;
- binding 1: specular prefilter texture view;
- binding 2: IBL sampler.

The report validates binding metadata and exposes JSON-safe layout/readiness
status. It does not create bind groups, change WGSL, add shader sampling, or
create public custom material APIs.

The GLTF scene status now exposes `ibl.bindGroupLayout` and grouped readiness
phase `readiness.ibl.phases.bindGroupLayout`.

## Deferred

- App-cache integration for IBL resources.
- IBL bind-group descriptor/resource creation.
- Specular prefilter texture allocation.
- WGSL IBL sampling.
