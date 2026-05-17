# GLB Accessor Validation Boundary Audit - 2026-05-17

## Scope

Audit the GLB accessor/buffer reference validation work from `task-0685` and
`task-0686` against Aperture's package boundaries and staged GLB import plan.

Audited files:

- `docs/research/GLB_ACCESSOR_BUFFER_REFERENCE_VALIDATION_PLAN_2026_05_17.md`
- `packages/render/src/assets/gltf-accessor-validation.ts`
- `test/assets/gltf-accessor-validation.test.ts`
- `test/assets/gltf-accessor-validation-json.test.ts`

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/research/GLB_ACCESSOR_BUFFER_REFERENCE_VALIDATION_PLAN_2026_05_17.md`
- `docs/research/MINIMAL_GLB_MESH_PRIMITIVE_SOURCE_MAPPING_PLAN_2026_05_17.md`
- `docs/research/MESH_GEOMETRY_COVERAGE.md`
- `references/bevy/crates/bevy_gltf/src/vertex_attributes.rs`
- `references/three.js/examples/jsm/loaders/GLTFLoader.js`
- `references/engine/src/framework/parsers/glb-parser.js`

## Findings

No boundary drift found.

The accessor validation helper stays in `@aperture-engine/render` and imports
only mesh primitive mapping report types. It does not import
`@aperture-engine/webgpu`, browser APIs, DOM globals, EliCS world/entity
mutation APIs, asset registry mutation APIs, render snapshots, `MeshAsset`, or
GPU resource types.

The helper validates JSON references, expected semantic formats, byte strides,
and byte ranges. It returns byte-range and expected-format metadata only. It
does not allocate typed arrays, decode buffers, construct mesh assets, compute
bounds, register source assets, author ECS commands, or prepare renderer
resources.

Sparse and zero-fill accessors are diagnosed as deferred instead of being
silently decoded. `uint8` index accessors are reported as
`uint8-to-uint16` expected format for the later decoding stage, but no
canonicalization happens in this helper.

The JSON helper clones report data and diagnostics without embedding GLB bytes,
typed arrays, mesh assets, ECS entities, or GPU handles.

## Validation

- Ownership scan for WebGPU/ECS/browser mutation, typed-array construction,
  `MeshAsset`, and registry mutation terms found only the JSON test's negative
  `GPU` assertion.
- `pnpm run check:boundaries` passed.
- `pnpm exec vitest run test/assets/gltf-accessor-validation.test.ts test/assets/gltf-accessor-validation-json.test.ts`
  passed.
- `pnpm run format:check` passed.

## Follow-Ups

No corrective refactor is needed.

The next GLB slice can proceed to the typed-array decoding report described in
`docs/research/GLB_TYPED_ARRAY_DECODING_REPORT_PLAN_2026_05_17.md`, or stay in
planning by defining the `MeshAsset` construction handoff before implementation.
