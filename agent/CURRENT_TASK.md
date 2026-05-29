# Current Task

No active task is currently checked out.

Status: SOTA roadmap M1-T8 spatial index auto-population completed in commit
`6d998669`.

Key findings:

- `populateSpatialIndexFromWorld()` now extracts live ECS `Mesh` +
  `WorldTransform` entries, honors `Pickable`, `RenderLayer`, `Visibility`, and
  `Enabled`, adapts ready `MeshAsset` geometry into spatial triangle meshes,
  and publishes both coarse bounds and mesh-BVH entries to `context.spatial`.
- `createApertureApp()` refreshes the derived spatial index on startup and
  during each app step, after world transforms are resolved.
- Focused Vitest coverage proves 2-mesh population, mesh-BVH hits with
  face/UV/normal data, moving-entity transform updates without BVH rebuilds,
  mesh-version rebuilds, disabled Pickable exclusion, and layer filtering.
- `examples/auto-picking.html` plus `test/e2e/auto-picking.spec.ts` prove
  `CameraHandle.rayFromPointer -> context.spatial.raycastFirst` hits an
  app-spawned mesh with source `mesh-bvh` and no manual spatial setup.
- `pnpm run check` passed after the M1-T8 feature slice.

Recommended next task:

- `M1-T9` — make the publishable packages installable: real version/license,
  package `files`/`publishConfig`, root `LICENSE`, export-path guards, and
  npm pack dry-run validation.
