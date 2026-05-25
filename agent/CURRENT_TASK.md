# Current Task

No active task is currently checked out.

Status: active `docs/RAYCASTING_BVH_FEATURE_PROPOSAL.md` implementation goal
completed.

Key findings:

- `@aperture-engine/simulation` now owns exact CPU mesh raycasts, typed-array
  mesh BVHs, shapecast-derived spatial queries, closest-point queries,
  BVH-vs-BVH candidate pairs, versioned cache/refit diagnostics, and
  entity-bounds BVH broad-phase raycasts.
- `@aperture-engine/render` only adapts source `MeshAsset` CPU buffers into the
  simulation spatial mesh contract; no WebGPU resources are query inputs.
- `@aperture-engine/app/systems` now exposes worker-side mesh spatial queries
  through `this.spatial.setMeshes(...)` and
  `this.spatial.raycast(ray, { mode: "mesh" })`.
- `Pickable` and `MeshQueryAcceleration` are registered ECS authoring
  components for spatial query policy.

Recommended next task:

- `task-3166` — resume the render-pipeline queue with a split-screen
  multi-camera route.
