# Current Task

## START HERE - Remaining M10 Joint/GamePlay Semantics

Current source state:

- Rapier is the shipped concrete physics backend. The deterministic test backend
  remains the headless proof backend; Havok is removed from the package graph.
- The generated simulation-worker route is the default developer/agent proof
  route. The dedicated Rapier physics-worker route remains supported as a
  transferable proof route with worker-owned query/debug/control actions, but it
  is not the next product focus.
- Asset-backed collider V1 is complete:
  - `@aperture-engine/physics` exposes backend-neutral triangle-mesh and
    heightfield geometry contracts.
  - `@aperture-engine/app` owns render `MeshAsset` to physics-geometry
    adaptation.
  - `@aperture-engine/physics-rapier` cooks provider-backed `convexHull`,
    static `trimesh`, and static `heightfield` colliders.
  - `examples/physics-large-scale.html` proves asset-backed terrain plus 256
    dynamic bodies in the simulation-worker route.

Last validation:

- `pnpm exec vitest run test/app/physics-collider-geometry.test.ts test/physics-rapier/rapier-backend.test.ts test/app/generated-worker-start.test.ts`
  passed with 3 test files and 72 tests.
- `pnpm exec playwright test test/e2e/physics-large-scale.spec.ts --reporter=line`
  passed.
- `pnpm run check` passed with 445 test files and 2486 tests.

Next concrete work:

1. Implement enforceable motor force caps or a truthful gameplay-owned fallback
   policy for `PhysicsJoint.motorMaxForce`.
2. Implement automatic `breakForce` / impulse-driven joint break semantics, or a
   bounded gameplay-owned break policy that remains honest about backend
   limitations.
3. Add native joint impulse readback if the active backend exposes enough data;
   otherwise keep `physics_joint_status` diagnostic-only and document why.
4. Broaden paired non-fixed joint frame semantics beyond current frameA-oriented
   unit axes, especially body-B frame behavior.
5. Keep every slice proven through pause/snapshot/edit-or-command/`ecs_step` or
   `ecs_step_and_diff`/query/`ecs_diff` in the generated simulation worker.

Reference anchors:

- `references/bevy/crates/bevy_app/src/main_schedule.rs`
- `references/engine/src/framework/components/joint/component.js`
- `references/engine/src/framework/components/rigid-body/system.js`
- Current Aperture joint/physics code in `packages/physics/src/backend.ts` and
  `packages/physics-rapier/src/joints.ts`.

Acceptance criteria for the next slice should include:

- A user-visible/generated-worker proof for the selected joint/gameplay
  semantic.
- Structured diagnostics for any backend limitation that remains unsupported.
- Focused backend/generated-worker coverage plus `pnpm run check`.
