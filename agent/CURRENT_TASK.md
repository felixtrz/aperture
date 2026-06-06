# Current Task

## START HERE — Profile Rapier Dedicated Worker Route

Current source state:

- `58df7607` committed the older M6 rendering/content work: sprites follow-up,
  MSDF text, UI quads, GPU particles, content showcase, quad snapshot
  transport, and focused tests.
- `73c29a62` committed the Rapier-first M10 physics foundation: physics
  packages, fixed-step runtime/app scheduling, ECS physics authoring/devtools,
  Rapier simulation-worker examples, benchmark route, and the first transferable
  dedicated-worker proof route.
- `22e1df82` refactored oversized physics backend entrypoints into package-style
  modules.
- `dc63a842` added the Rapier dedicated-worker action protocol, proxy methods,
  backend dispatch, real worker-owned raycast/debug example data, and focused
  worker route tests.
- The current Rapier dedicated physics-worker route now supports transferable
  step/writeback plus worker-owned raycast, overlap/shape/point query,
  character movement, sleep/wake, and debug-geometry actions.
- Havok implementation remains removed from the shipped package graph. Current
  concrete backends are deterministic test physics and Rapier.

Next concrete work:

1. Add a larger-scene browser benchmark/proof mode that compares the generated
   simulation-worker route with the dedicated Rapier physics-worker route.
2. Report fixed-step timing, transfer bytes, worker action latency, body/readback
   counts, ECS writeback/diff or deterministic state signatures, and WebGPU
   pixel proof for both modes.
3. Cover body-heavy, query-heavy, and character-heavy pressure without silently
   falling back to the deterministic test backend.
4. Keep the generated simulation worker as the default developer workflow unless
   profiling data clearly justifies promoting the dedicated worker route.

Reference anchor: `references/bevy/crates/bevy_tasks/src/task_pool.rs` and
`references/bevy/crates/bevy_ecs/src/schedule/executor/multi_threaded.rs` for
task/schedule separation patterns.

Follow-up visible-feature task:

Add mesh/heightfield collider cooking for Rapier asset colliders, with ECS
pause/edit/step/diff coverage and a browser route that proves a trimesh or
heightfield collider affects physics queries and writeback.

Reference anchor: `references/bevy/crates/bevy_mesh/src/primitives` and
`references/bevy/crates/bevy_pbr/src/render/mesh.rs` for asset-to-runtime
preparation boundaries, plus Rapier collider descriptor docs in the installed
`@dimforge/rapier3d-compat` package.
