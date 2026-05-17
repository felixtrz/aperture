# GLB Mesh Mapping Boundary Audit - 2026-05-17

## Scope

Audit the new minimal GLB mesh primitive mapping work from `task-0675` through
`task-0677` against Aperture's ECS-authoritative, renderer-derived, WebGPU-only
architecture.

Audited files:

- `docs/research/MINIMAL_GLB_MESH_PRIMITIVE_SOURCE_MAPPING_PLAN_2026_05_17.md`
- `packages/render/src/assets/gltf-mesh-primitive.ts`
- `test/assets/gltf-mesh-primitive.test.ts`
- `test/assets/gltf-mesh-primitive-json.test.ts`

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/research/GLB_ECS_AUTHORING_COMMAND_HANDOFF_PLAN_2026_05_17.md`
- `docs/research/MESH_GEOMETRY_COVERAGE.md`
- `references/bevy/crates/bevy_gltf/src/loader/mod.rs`
- `references/bevy/crates/bevy_gltf/src/loader/gltf_ext/mesh.rs`
- `references/three.js/examples/jsm/loaders/GLTFLoader.js`
- `references/engine/src/framework/parsers/glb-parser.js`

## Findings

No boundary drift found.

The mesh primitive mapper stays inside `@aperture-engine/render` and imports
only simulation asset-handle helpers plus renderer-owned mesh and root-report
types. It does not import `@aperture-engine/webgpu`, browser APIs, DOM globals,
EliCS world/entity mutation APIs, render snapshots, or GPU resource types.

The helper plans deterministic source mesh handle keys and validates glTF JSON
references only. It reports unresolved accessor data as a warning and leaves
`mesh` as `null`, which keeps buffer decoding and `MeshAsset` construction out
of scope for this slice.

The JSON helper summarizes future `MeshAsset` source data instead of embedding
typed arrays. Current report output preserves planned handle keys, source mesh
and primitive indices, attribute/index references, material index, topology, and
diagnostics without raw buffers or GPU data.

The scene/node traversal plan also preserves the required separation: it defines
serializable entity keys and transform diagnostics, but explicitly blocks ECS
world mutation, primitive renderable command planning, registry writes, render
extraction, and WebGPU preparation.

## Validation

- Ownership scan for WebGPU/ECS/browser mutation terms in the new mesh helper
  and tests returned no matches.
- `pnpm run check:boundaries` passed.
- `pnpm exec vitest run test/assets/gltf-mesh-primitive.test.ts test/assets/gltf-mesh-primitive-json.test.ts`
  passed.
- `pnpm run format:check` passed.

## Follow-Ups

No corrective refactor is needed.

The next implementation slice should add scene/node traversal diagnostics from
`docs/research/GLB_SCENE_NODE_TRAVERSAL_DIAGNOSTICS_PLAN_2026_05_17.md`, or add
an explicit accessor/buffer validation plan if mesh source asset construction is
prioritized first.
