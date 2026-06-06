# Current Task

## START HERE — Rapier Asset-Backed Colliders And Large-Scale Physics

Current source state:

- `73c29a62` committed the Rapier-first M10 physics foundation: physics
  packages, fixed-step runtime/app scheduling, ECS physics authoring/devtools,
  Rapier simulation-worker examples, benchmark route, and the first transferable
  dedicated-worker proof route.
- `22e1df82` refactored oversized physics backend entrypoints into package-style
  modules.
- `dc63a842` added the Rapier dedicated-worker action protocol, proxy methods,
  backend dispatch, real worker-owned raycast/debug example data, and focused
  worker route tests.
- Havok implementation remains removed from the shipped package graph. Current
  concrete backends are deterministic test physics and Rapier.
- The dedicated Rapier physics-worker route remains supported, but the next
  product work should not benchmark against it or promote it. Keep the generated
  simulation-worker route as the default developer/agent workflow.

Next concrete work:

1. Implement Rapier asset-backed collider cooking for ECS-authored `convexHull`,
   `trimesh`, and static `heightfield` colliders.
2. Add a backend-neutral collider geometry provider so `@aperture-engine/physics`
   does not import render assets and `@aperture-engine/physics-rapier` does not
   reach into the app asset registry directly.
3. Reuse the existing render mesh spatial adapter to convert registered
   `MeshAsset` CPU geometry into backend-neutral triangle mesh geometry.
4. Prove generated-worker pause/snapshot/edit-or-command/step/query/diff over a
   real asset-backed collider path.
5. Add a large-scale simulation-worker browser example with asset-backed terrain
   and hundreds of dynamic primitive bodies.

Plan document: `docs/PHYSICS_ASSET_COLLIDER_PLAN.md`.

Reference anchors:

- `references/bevy/crates/bevy_mesh/src/lib.rs`
- `references/bevy/crates/bevy_mesh/src/index.rs`
- `packages/render/src/mesh/spatial-adapter.ts`
- `packages/physics-rapier/src/colliders.ts`

Acceptance criteria:

- Rapier cooks at least one `trimesh` or `heightfield` collider from ECS
  asset-backed collider authoring in the simulation-worker route.
- Missing/invalid collider assets remain structured diagnostics.
- Dynamic non-convex asset colliders do not silently run.
- `examples/physics-large-scale.html` proves a larger scene with asset-backed
  terrain and hundreds of dynamic bodies.
- Focused Rapier/generated-worker tests, the new large-scale Playwright test,
  and `pnpm run check` pass.

Follow-up visible-feature task:

After asset-backed colliders and the large-scale example are green, continue the
remaining M10 physics semantics: enforceable motor force caps, automatic
`breakForce` / impulse-driven joint breaks, native joint impulse readback, and
broader paired non-fixed joint frame semantics.
