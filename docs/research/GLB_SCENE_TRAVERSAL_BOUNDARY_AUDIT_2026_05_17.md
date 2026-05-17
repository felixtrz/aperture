# GLB Scene Traversal Boundary Audit - 2026-05-17

## Scope

Audit the new GLB scene traversal diagnostics work from `task-0680` and
`task-0681` against Aperture's ECS-authoritative, renderer-derived, WebGPU-only
architecture.

Audited files:

- `docs/research/GLB_SCENE_NODE_TRAVERSAL_DIAGNOSTICS_PLAN_2026_05_17.md`
- `packages/render/src/assets/gltf-scene-traversal.ts`
- `test/assets/gltf-scene-traversal.test.ts`
- `test/assets/gltf-scene-traversal-json.test.ts`

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/research/GLB_SCENE_NODE_TRAVERSAL_DIAGNOSTICS_PLAN_2026_05_17.md`
- `docs/research/GLB_ECS_AUTHORING_COMMAND_HANDOFF_PLAN_2026_05_17.md`
- `packages/simulation/src/transform/components.ts`
- `references/bevy/crates/bevy_gltf/src/loader/mod.rs`
- `references/bevy/crates/bevy_gltf/src/loader/gltf_ext/scene.rs`

## Findings

No boundary drift found.

The scene traversal helper stays in `@aperture-engine/render` and imports only
the renderer-independent GLB root validation helper. It does not import
`@aperture-engine/webgpu`, browser APIs, DOM globals, EliCS world/entity
mutation APIs, render snapshots, asset registries, or GPU resource types.

The report uses serializable string keys such as `gltf:scene:0` and
`gltf:node:1`. The ownership scan found expected field names like
`sceneEntityKey`, `parentEntityKey`, and `entityKey`, but no `EcsWorld`,
`Entity`, `addComponent`, `createEntity`, `RenderSnapshot`, or WebGPU API usage.

The helper validates scene selection, root-node references, child references,
cycle paths, transform tuple shapes, and matrix-transform deferral. Matrix nodes
are preserved as JSON-safe matrix payloads with
`gltfScene.unsupportedMatrixDecomposition` warnings instead of being silently
converted into ECS `LocalTransform` data.

The JSON helper clones arrays and diagnostics into plain data. Tests confirm the
output preserves scene keys, node keys, parent relationships, transform payloads,
cycle paths, and matrix-decomposition warnings without embedding ECS objects,
component instances, mesh buffers, or GPU handles.

## Validation

- Ownership scan for WebGPU/ECS/browser mutation terms in the scene traversal
  helper and tests found only expected serializable key names/test strings.
- `pnpm run check:boundaries` passed.
- `pnpm exec vitest run test/assets/gltf-scene-traversal.test.ts test/assets/gltf-scene-traversal-json.test.ts`
  passed.
- `pnpm run format:check` passed.

## Follow-Ups

No corrective refactor is needed.

The next GLB implementation slice should either implement accessor/buffer
reference validation from
`docs/research/GLB_ACCESSOR_BUFFER_REFERENCE_VALIDATION_PLAN_2026_05_17.md` or
plan primitive material resolution before an ECS authoring command planner
combines scene nodes, mesh handles, and material handles.
