# Physics Backend Comparison

Updated: 2026-06-06

## Current Decision

Rapier is the production physics backend for Aperture's first physics milestone.
The shipped source graph contains:

- `@aperture-engine/physics`: backend-neutral ECS authoring, command/result
  contracts, validation, fixed-step helpers, benchmark helpers, test backend,
  worker protocol, and transferable worker proxy helpers.
- `@aperture-engine/physics-rapier`: the concrete Rapier adapter.
- Deterministic test backend coverage for agent/devtools proofs.

The previous Havok prototype package has been removed. Havok and Jolt remain
candidate adapters only if they can beat or meaningfully complement Rapier
through the same ECS-authoritative simulation-worker proof route.

## Why Rapier

Rapier is the best fit for Aperture now because it is ECS-friendly, small enough
for the browser route, exposes the features needed by the current milestone, and
already works through the pause/snapshot/edit-or-command/step/diff workflow.

Implemented Rapier coverage includes:

- Dynamic/static/kinematic rigid bodies and primitive colliders.
- Collision/trigger events, contact forces, raycasts, overlap queries, shape
  casts, and point projection.
- Character-controller movement with slope, autostep, snap-to-ground, and
  collision diagnostics.
- Fixed/spherical/revolute/prismatic/distance joints with limits, motors, and
  frameA-oriented unit axes.
- Debug geometry and debug summaries.
- Simulation-worker fixed-step writeback, browser examples, and generated-worker
  devtools proofs.
- A transferable dedicated-worker route that returns body packets to the
  simulation worker and supports worker-owned query/debug/control actions,
  while keeping simulation-worker physics as the default until profiling says
  otherwise.

## Current Gaps

- Mesh/heightfield collider cooking is not implemented; asset-backed collider
  shapes report `physics.collider.assetShape.unsupported`.
- Generic joints report `physics.joint.unsupported`.
- Automatic break-force enforcement, native joint impulse readback, motor force
  limits, and paired non-fixed body-B frame semantics remain unsupported.
- The dedicated physics worker still needs broader long-running profiling and
  larger-scene E2E coverage before it becomes the default route.

## Candidate Backends

| Backend | Current status           | Reason not shipped                                                                                                                                                                           |
| ------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rapier  | Shipped concrete backend | Default path.                                                                                                                                                                                |
| Havok   | Future candidate only    | Previous prototype was removed; it did not beat Rapier and added package/WASM complexity without parity for joints, character movement, debug geometry, or generated-worker gameplay proofs. |
| Jolt    | Future candidate only    | Larger browser payload and no Aperture adapter yet.                                                                                                                                          |

## Evidence To Revisit

Add or revive another backend only when it can pass the same acceptance route:

- ECS-authoritative command sync and writeback.
- `ecs_pause` / `ecs_snapshot` / edit-or-command / `ecs_step` or
  `ecs_step_and_diff` / query / `ecs_diff` proofs.
- Browser benchmark reports across the same scenario matrix.
- Clear evidence of a capability, performance, payload-size, licensing, or
  determinism advantage over Rapier.
