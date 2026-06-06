# Physics Implementation Plan

Updated: 2026-06-06

## Direction

Aperture physics is Rapier-first and ECS-authoritative.

The default route is:

1. ECS authoring components are the source of truth.
2. Fixed-step systems collect backend-neutral physics commands from ECS.
3. Rapier steps at the simulation-worker fixed-step boundary.
4. Readback writes derived `PhysicsBodyState` and transform data back into ECS.
5. Render extraction observes ECS after physics writeback.
6. Agents and developers verify behavior through
   `ecs_pause` / `ecs_snapshot` / edit-or-command / `ecs_step` or
   `ecs_step_and_diff` / query / `ecs_diff`.

The dedicated physics-worker route is now Rapier-first and transfer-based. It
owns backend-side query/debug/control hooks needed by the browser worker-mode
route, but it is not the next product focus. Keep the generated simulation
worker as the default gameplay and agent-proof route.

## Implemented

- `@aperture-engine/physics`
  - ECS authoring components for rigid bodies, colliders, velocity, forces,
    impulses, gravity, material, debug options, character controllers, joints,
    and derived body state.
  - Backend-neutral command/result/event/query contracts.
  - Fixed-step helpers, validation, benchmark helpers, deterministic test
    backend, worker protocol, and transferable worker packet helpers.
  - Dedicated worker action messages for raycasts, overlap/shape/point queries,
    character movement, sleep/wake, and debug geometry.
  - ECS sync/writeback for body, collider, joint, character, event, query, and
    debug geometry workflows.
  - Backend-neutral collider geometry provider contracts for asset-backed
    triangle meshes and heightfields, with structured missing/not-ready/invalid
    geometry diagnostics.
- `@aperture-engine/physics-rapier`
  - Concrete Rapier backend with primitive colliders, events, queries,
    character movement, debug geometry, and supported impulse joints.
  - Provider-backed `convexHull`, static `trimesh`, and static `heightfield`
    collider cooking from backend-neutral geometry.
  - Structured unsupported-feature reporting for unsupported authored
    semantics.
- Runtime/app integration
  - Fixed-step scheduling after variable app systems/animation and before
    transform resolution/render extraction.
  - Runtime physics helpers and app spawn descriptors.
  - Scene/prefab serialization support, including entity-ref remapping for
    joint body refs and exclusion of derived body state.
  - Generated-worker devtools physics tools and `ecs_step_and_diff`.
  - App-side asset-backed collider geometry provider that adapts registered
    render `MeshAsset` CPU geometry through the render spatial adapter without
    letting physics or Rapier import app/render packages.
- Examples/tests
  - `physics-settling`, `physics-joints`, `physics-character`,
    `physics-benchmark`, `physics-worker-mode`, and `physics-large-scale`.
  - Focused unit, runtime, generated-worker, serialization, Rapier asset-cooking,
    and E2E coverage.

## Backend Policy

Current concrete backends:

- Deterministic test backend.
- Rapier.

Removed/parked:

- Havok implementation package and tests were removed from the shipped source
  graph. Havok remains a future candidate only if it can beat or complement
  Rapier through the same simulation-worker proof route.
- Jolt remains a future candidate only.
- Shared-buffer third-worker physics remains future work.

## Dedicated Worker Route

The current dedicated route is transfer-based, not shared-ECS mutation:

- The simulation worker collects ECS physics commands.
- `createPhysicsWorkerTransferProxy(...)` sends a fixed-step request to a
  physics worker endpoint.
- The physics worker runs Rapier and returns transferable body/result packets.
- The simulation worker applies writeback at the fixed-step boundary.
- The same proxy can send action requests for raycasts, overlap/shape/point
  queries, character movement, sleep/wake, and debug geometry to the worker-owned
  backend.
- `examples/physics-worker-mode.html` proves off-thread Rapier stepping,
  transferable writeback, worker-side raycast queries, and worker-side debug
  geometry in a browser route.

This preserves ECS ownership and keeps render extraction downstream of ECS
state. Do not promote this route by default without a future explicit decision.

## Asset-Backed Collider Status

The asset-backed collider slice is implemented for the default
simulation-worker route. See `docs/PHYSICS_ASSET_COLLIDER_PLAN.md`.

The implementation keeps `@aperture-engine/physics` backend-neutral, adapts
render `MeshAsset` CPU geometry through an app-owned provider boundary, cooks
Rapier `convexHull`, static `trimesh`, and static `heightfield` colliders, and
proves the path through generated-worker pause/step/query/diff plus a
large-scale browser example.

## Remaining Work

1. Asset-backed collider V2 semantics: non-unit scale baking/recreation,
   compound multi-submesh cooking metadata, dynamic non-convex policy, optional
   async/decimated cooking, and promotion of provider plumbing to any future
   dedicated-worker route if that route becomes a product focus again.
2. Broader gameplay semantics around contact filtering, sensors, and controller
   edge cases.
3. Generic joint descriptor design or explicit permanent exclusion.
4. Native joint impulse readback, automatic break-force enforcement, motor force
   limits, and paired non-fixed body-B frame semantics.
5. Longer-running E2E/benchmark coverage for larger physics scenes.

## Verification Pattern

For physics-enabled experiences, prefer concrete ECS diff proofs:

1. `ecs_pause`
2. `ecs_snapshot`
3. Edit ECS with `ecs_set_component_field` or call a physics devtools command.
4. `ecs_step` or `ecs_step_and_diff`
5. Physics query tool when needed.
6. `ecs_diff`

This keeps tests and agent workflows grounded in the actual ECS state that will
feed rendering.
