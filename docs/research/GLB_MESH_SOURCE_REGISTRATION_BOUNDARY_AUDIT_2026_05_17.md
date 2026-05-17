# GLB Mesh Source Registration Boundary Audit - 2026-05-17

## Scope

Audited the GLB mesh source asset registration slice introduced by
`task-0702` and `task-0703`.

Audited files:

- `docs/research/GLB_MESH_SOURCE_ASSET_REGISTRATION_PLAN_2026_05_17.md`
- `packages/render/src/assets/gltf-mesh-source-registration.ts`
- `test/assets/gltf-mesh-source-registration.test.ts`
- `test/assets/gltf-mesh-source-registration-json.test.ts`

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/research/GLB_MESH_SOURCE_ASSET_REGISTRATION_PLAN_2026_05_17.md`
- `packages/render/src/assets/gltf-source-registration.ts`
- `packages/simulation/src/assets/registry.ts`
- `references/bevy/crates/bevy_gltf/src/loader/mod.rs`
- `references/bevy/crates/bevy_gltf/src/loader/gltf_ext/mesh.rs`

## Findings

No boundary drift found.

The mesh source registration helper stays in `@aperture-engine/render` and
depends only on simulation asset-handle/registry contracts plus
renderer-independent `MeshAsset` source data. It does not import
`@aperture-engine/webgpu`, browser APIs, DOM globals, runtime app facades, ECS
world/entity mutation APIs, render snapshots, render packets, or GPU resource
types.

The helper mutates only the caller-provided `AssetRegistry` by registering
constructed `MeshAsset` source data as ready `mesh` assets. Duplicate mesh keys
are skipped with diagnostics and existing registry entries are not overwritten.
Invalid planned mesh entries are skipped without registry mutation.

The handle policy follows the mesh construction plan: the normalized planned
mesh id is used to create a `MeshHandle`, and prefixed planned keys are stripped
before handle creation so `mesh:` is not double-prefixed. Registration reports
preserve both planned and registered handle keys for later ECS authoring.

The JSON helper returns written/skipped handle keys, mesh/primitive indices,
reasons, and diagnostics only. It does not embed `MeshAsset` source buffers,
typed arrays, registry entries, ECS entities, or GPU handles.

This matches the Bevy-inspired pattern inspected in the local glTF loader:
primitive mesh assets are created and labeled before later scene/entity
spawning binds mesh and material handles. Aperture keeps that separation by
ending this slice at source asset registry mutation.

## Validation

- Ownership scan for WebGPU/browser/ECS mutation/render-packet terms in the new
  helper and tests returned no matches.
- `pnpm run check:boundaries` passed.
- `pnpm exec vitest run test/assets/gltf-mesh-source-registration.test.ts test/assets/gltf-mesh-source-registration-json.test.ts`
  passed.
- `pnpm exec tsc --noEmit -p tsconfig.test.json` passed during the
  implementation and JSON test slices.

## Follow-Ups

No corrective refactor is needed.

The next safe slice is
`task-0705 — Plan GLB ECS authoring command integration from source reports`,
which should consume scene traversal diagnostics, registered mesh handles, and
resolved material handles without mutating ECS in the planning step.
