# StandardMaterial IBL Bind-Group Descriptor Implementation — 2026-05-19

## Task

Completed `task-1847`: add JSON-safe StandardMaterial IBL bind-group
descriptor planning.

## Reference Anchors

- `packages/webgpu/src/webgpu/standard-bind-group.ts`
- `packages/webgpu/src/webgpu/matcap-bind-group.ts`
- `packages/webgpu/src/webgpu/standard-material-ibl-bind-group-layout.ts`
- `packages/webgpu/src/webgpu/diffuse-ibl-resource-summary.ts`
- `docs/research/IBL_BIND_GROUP_RESOURCE_DESCRIPTOR_SLICE_PLAN_2026_05_19.md`

## Implementation

- Added `standard-material-ibl-bind-group.ts`.
- Added group 4 descriptor planning for:
  - binding 0: diffuse irradiance texture resource key;
  - binding 1: specular prefilter texture resource key; and
  - binding 2: IBL sampler resource key.
- Added JSON helpers and readiness diagnostics.
- Kept live `GPUBindGroup` creation and WGSL sampling deferred.
- Updated the GLTF scene status with `ibl.bindGroupDescriptor` and a
  `readiness.ibl.phases.bindGroupDescriptor` phase.

## Validation

- `pnpm exec vitest run test/webgpu/standard-material-ibl-bind-group.test.ts test/webgpu/standard-material-ibl-bind-group-layout.test.ts`
- `pnpm run typecheck:test`
- `pnpm exec playwright test test/e2e/gltf-scene.spec.ts`

## Follow-Up

Once specular IBL resource allocation is available, the descriptor plan can
become valid while still keeping live bind-group creation deferred.
