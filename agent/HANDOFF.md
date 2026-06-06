# Handoff - Rapier Asset-Backed Colliders

**Updated:** 2026-06-06 11:52 PDT

This run completed the asset-backed collider plan in
`docs/PHYSICS_ASSET_COLLIDER_PLAN.md`. Physics remains Rapier-first and
ECS-authoritative, with the generated simulation worker as the default
developer/agent proof route.

## Completed

- Added backend-neutral triangle-mesh and heightfield geometry contracts in
  `@aperture-engine/physics`.
- Added an app-owned asset-backed collider geometry provider that adapts ready
  render `MeshAsset` CPU geometry through the existing render spatial adapter,
  caches by asset version, and reports missing/not-ready/invalid geometry
  diagnostics.
- Extended the Rapier backend to cook provider-backed `convexHull`, static
  `trimesh`, and static `heightfield` colliders into real Rapier colliders.
- Kept unsupported semantics explicit: no provider, missing/invalid assets,
  dynamic `trimesh`/`heightfield`, and non-unit asset-collider scale report
  structured unsupported features instead of using primitive fallbacks.
- Proved generated-worker pause/snapshot/edit/`ecs_step_and_diff`/query/diff
  against a real provider-backed `trimesh` collider.
- Added `examples/physics-large-scale.html`, which runs Rapier in the
  simulation-worker route with asset-backed terrain plus 256 dynamic bodies.
- Updated physics implementation docs, backend comparison notes, the public
  tracker, SOTA roadmap, backlog, current task, and completion log.

## Validation Run

- `pnpm exec vitest run test/app/physics-collider-geometry.test.ts test/physics-rapier/rapier-backend.test.ts test/app/generated-worker-start.test.ts`
  passed with 3 test files and 72 tests.
- `pnpm exec playwright test test/e2e/physics-large-scale.spec.ts --reporter=line`
  passed.
- `pnpm run check` passed with 445 test files and 2486 tests.

## Current State

Asset-backed collider V1 is implemented for the default simulation-worker
route. `@aperture-engine/physics` remains backend-neutral, `@aperture-engine/app`
owns render-asset adaptation, and `@aperture-engine/physics-rapier` consumes
provider geometry without importing app/render packages.

Bevy was checked as the ECS/fixed-schedule/mesh-extraction reference, not as a
collider-cooking parity source. PlayCanvas was checked as the direct
asset-backed mesh collider cooking reference.

## Known Gaps

- Asset-collider V2 scale baking/recreation, dynamic non-convex policy,
  async/decimated cooking, and richer compound mesh cooking metadata remain
  future work.
- Generic joints, automatic break-force enforcement, native joint impulse
  readback, motor force limits, and broader paired non-fixed body-B frame
  semantics remain unsupported or diagnostic-only.
- The dedicated physics-worker route remains a supported Rapier transferable
  proof route, but it is not the next product focus unless a future explicit
  decision promotes it.

## Recommended Next Task

Continue remaining M10 joint/gameplay semantics through the generated
simulation-worker proof route: enforceable motor force caps, automatic
`breakForce` / impulse-driven joint breaks, native joint impulse readback, and
broader paired non-fixed joint frame semantics.
