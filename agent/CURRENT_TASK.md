# Current Task

## START HERE — Validate And Push Committed Feature Slices

Current source state:

- `58df7607` committed the older M6 rendering/content work: sprites follow-up,
  MSDF text, UI quads, GPU particles, content showcase, quad snapshot
  transport, and focused tests.
- `73c29a62` committed the Rapier-first M10 physics work: physics packages,
  fixed-step runtime/app scheduling, ECS physics authoring/devtools, Rapier
  simulation-worker examples, benchmark route, and Rapier transferable
  dedicated-worker proof route.
- Havok implementation was removed from the package graph before the physics
  commit. Current shipped concrete backends are deterministic test physics and
  Rapier.

Next concrete work:

1. Finish docs/public tracker cleanup for the Rapier-only source state.
2. Run full validation: `pnpm run check` or the closest practical subset plus
   focused E2E physics/content routes.
3. Commit docs/status cleanup.
4. Push `main`.

Recommended next visible-feature task after this run:

Add mesh/heightfield collider cooking for Rapier asset colliders, with ECS
pause/edit/step/diff coverage and a browser route that proves a trimesh or
heightfield collider affects physics queries and writeback.

Reference anchor: `references/bevy/crates/bevy_mesh/src/primitives` and
`references/bevy/crates/bevy_pbr/src/render/mesh.rs` for asset-to-runtime
preparation boundaries, plus Rapier collider descriptor docs in the installed
`@dimforge/rapier3d-compat` package.
