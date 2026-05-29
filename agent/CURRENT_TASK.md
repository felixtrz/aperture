# Current Task

No active task is currently checked out.

Status: SOTA roadmap M1-T7 camera ray unprojection completed in commit
`e1f9ce21`.

Key findings:

- `CameraHandle.rayFromPointer()` now reads ECS `Camera` and
  `WorldTransform`, builds renderer-matched perspective/orthographic
  projections, inverts the view-projection matrix, and returns normalized
  world-space rays from normalized pointer coordinates.
- `test/app/cameras.test.ts` covers perspective center/corner rays,
  orthographic parallel rays with shifted origins, and
  `rayFromPointer -> context.spatial.raycastFirst` bounds picking.
- The developer-api manual picking fixture now places its temporary bounds on
  the spawned crate so the existing select pointer works with real camera rays.
- `pnpm run check` passed after the M1-T7 feature slice.

Recommended next task:

- `M1-T8` — populate the spatial index from live ECS `Pickable`/`Mesh`/
  `WorldTransform` state so app-level raycasts work without manual
  `context.spatial.setBounds()` or `setMeshes()` calls.
