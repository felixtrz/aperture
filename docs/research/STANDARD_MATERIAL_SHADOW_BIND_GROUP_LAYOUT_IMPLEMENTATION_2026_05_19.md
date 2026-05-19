# StandardMaterial Shadow Bind-Group Layout Implementation — 2026-05-19

## Task

Implemented `task-1843`: add descriptor-only StandardMaterial shadow bind-group
layout metadata.

## Reference Anchors

- `packages/webgpu/src/webgpu/shadow-depth-texture-resource.ts`
- `packages/webgpu/src/webgpu/shadow-matrix-buffer-descriptor.ts`
- `packages/webgpu/src/webgpu/standard-material-ibl-bind-group-layout.ts`
- `docs/research/STANDARD_MATERIAL_SHADOW_BIND_GROUP_LAYOUT_SLICE_PLAN_2026_05_19.md`

## Implementation

Added `StandardMaterialShadowBindGroupLayoutReadinessReport` in
`packages/webgpu`. The descriptor-only layout uses group 5 for shadow inputs:

- binding 0: directional shadow matrix buffer;
- binding 1: directional shadow depth texture;
- binding 2: directional shadow comparison sampler.

The report validates required binding metadata and exposes JSON-safe layout
readiness. It does not create bind groups, allocate comparison samplers, change
WGSL, submit shadow passes, or activate StandardMaterial shadow sampling.

The GLTF scene status now exposes `shadow.bindGroupLayout` and grouped
readiness phase `readiness.shadow.phases.bindGroupLayout`.

## Deferred

- Shadow matrix buffer allocation/upload.
- Comparison sampler allocation.
- Shadow bind-group resource creation.
- Shadow pass submission.
- StandardMaterial shadow sampling.
