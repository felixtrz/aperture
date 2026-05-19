# Directional Shadow Matrix Computation Implementation — 2026-05-19

## Task

Implemented `task-1842`: compute directional shadow view/projection matrices as
JSON-safe renderer-derived data.

## Reference Anchors

- `packages/webgpu/src/webgpu/directional-shadow-view-projection-plan.ts`
- `packages/webgpu/src/webgpu/shadow-matrix-buffer-descriptor.ts`
- `packages/webgpu/src/webgpu/shadow-depth-texture-resource.ts`
- `docs/research/FIRST_SHADOW_MATRIX_UPLOAD_RESOURCE_SLICE_PLAN_2026_05_19.md`
- `@aperture-engine/simulation` math helpers.

## Implementation

Added `DirectionalShadowMatrixComputationReport` in `packages/webgpu`.

The report:

- consumes directional shadow view/projection plans and extracted
  `RenderSnapshot.transforms`;
- derives the directional light direction from the extracted light world
  transform;
- computes deterministic light view, orthographic projection, and
  view-projection matrices for the single directional shadow-map path;
- keeps matrix arrays JSON-safe; and
- leaves GPU buffer allocation/upload and shadow pass submission deferred.

The GLTF scene status now exposes `shadow.matrixComputation` and grouped
readiness phase `readiness.shadow.phases.matrixComputation`.

## Deferred

- Shadow matrix GPU buffer allocation/upload.
- Shadow pass command encoding/submission.
- StandardMaterial shadow-map bind-group resource creation.
- StandardMaterial shadow sampling.
