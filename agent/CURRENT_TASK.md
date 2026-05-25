# Current Task

No active task is currently checked out.

Status: active spatial-query reshape goal completed.

Key findings:

- `docs/SPATIAL_QUERY_RESHAPE_PROPOSAL.md` records the no-separate-BVH-worker
  direction and the optimal from-scratch shape for synchronous gameplay spatial
  queries.
- `@aperture-engine/simulation` no longer exports the `mesh-bvh-worker` module,
  async BVH build/cache APIs, or `useSharedArrayBuffer` BVH build option.
- `MeshBvh.shapecast(...)` has been renamed to `visitMeshBvh(...)` so public
  "shape cast" vocabulary remains available for future swept-shape gameplay
  queries.
- `@aperture-engine/app` exposes `this.spatial.raycastFirst(...)` and
  `this.spatial.raycastAll(...)` with explicit `source` and `fallback` policy
  instead of the worker-era `raycast(..., { mode: "best" })` shape.
- Focused coverage for the extracted spatial query facade is 100% statements,
  branches, functions, and lines.

Recommended next task:

- `task-3166` — resume the render-pipeline queue with a split-screen
  multi-camera route.
