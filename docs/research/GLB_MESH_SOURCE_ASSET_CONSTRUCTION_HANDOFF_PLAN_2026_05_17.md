# GLB Mesh Source Asset Construction Handoff Plan - 2026-05-17

## Scope

Plan how decoded GLB primitive arrays should become renderer-independent
`MeshAsset` source data.

This is a planning slice only. It must not implement mesh construction, mutate
the asset registry, author ECS entities, create render snapshots, or touch
WebGPU.

Reference anchors:

- `docs/research/GLB_ACCESSOR_BUFFER_REFERENCE_VALIDATION_PLAN_2026_05_17.md`
- `docs/research/GLB_TYPED_ARRAY_DECODING_REPORT_PLAN_2026_05_17.md`
- `docs/research/MINIMAL_GLB_MESH_PRIMITIVE_SOURCE_MAPPING_PLAN_2026_05_17.md`
- `docs/research/MESH_GEOMETRY_COVERAGE.md`
- `packages/render/src/mesh/types.ts`
- `packages/render/src/mesh/primitives.ts`
- Bevy glTF primitive sub-asset loading in
  `references/bevy/crates/bevy_gltf/src/loader/mod.rs`

Common reference pattern: reference engines create one geometry/mesh resource
per glTF primitive, then associate that primitive with material and scene/node
relationships later. Aperture should follow the same primitive sub-asset idea
while producing plain `MeshAsset` source data for the asset registry, not
renderer-owned buffers or scene objects.

## Proposed Helper

Add later under `packages/render/src/assets`:

```ts
createMeshAssetsFromGltfDecodedAccessors(input):
  GltfMeshAssetConstructionReport
```

Inputs:

- `decodedReport`: future `GltfAccessorDecodingReport`.
- Optional `labelPrefix`, defaulting to the primitive mesh handle key.
- Optional bounds policy:
  - `"require-position-bounds"` default: compute from decoded `POSITION`.
  - `"preserve-accessor-bounds"` later: use validated accessor min/max when
    trustworthy.

The helper may import `MeshAsset` types and pure bounds/math helpers. It should
not import `AssetRegistry`, ECS component definitions, render extraction, or
WebGPU backend modules.

## MeshAsset Mapping

For each decoded primitive:

- `kind`: `"mesh"`.
- `label`: deterministic from mesh handle key or source mesh/primitive indices.
- `vertexStreams`: one source stream for the first slice.
  - `id`: `"gltf-primitive-interleaved"` or deterministic equivalent.
  - `arrayStride`: derived from packed output attributes.
  - `vertexCount`: from decoded `POSITION`.
  - attributes:
    - `POSITION`: `float32x3`, offset 0.
    - `NORMAL`: `float32x3`, next offset when present.
    - `TEXCOORD_0`: `float32x2`, next offset when present.
  - `data`: packed `Float32Array` containing only decoded supported
    attributes.
- `indexBuffer`: optional.
  - `uint8-to-uint16` decoded indices become `uint16`.
  - `uint16` stays `uint16`.
  - `uint32` stays `uint32`.
- `submeshes`: one submesh.
  - `label`: deterministic primitive label.
  - `topology`: `"triangle-list"`.
  - `materialSlot`: `0`.
  - `vertexStart`: `0`.
  - `vertexCount`: decoded vertex count.
  - `indexStart`: `0`.
  - `indexCount`: decoded index count or `0` for non-indexed primitives.
- `materialSlots`: one slot with index `0`.
- `localAabb` and `localSphere`: computed from decoded `POSITION`.

This keeps multi-material or multi-primitive meshes represented as multiple
single-primitive `MeshAsset`s in the first GLB path, matching the existing ECS
authoring plan that creates one renderable entity per primitive.

## Validation And Diagnostics

Construction diagnostics should include:

- `gltfMeshAsset.missingPosition`
- `gltfMeshAsset.mismatchedAttributeCount`
- `gltfMeshAsset.unsupportedSemantic`
- `gltfMeshAsset.invalidIndexValue`
- `gltfMeshAsset.missingBounds`
- `gltfMeshAsset.invalidBounds`
- `gltfMeshAsset.tangentGenerationDeferred`

Rules:

- `POSITION` is required.
- Optional attributes must match the `POSITION` vertex count.
- Index values must be less than vertex count after decoding.
- Bounds must be finite and non-inverted.
- Missing tangents should be diagnosed only when normal-mapped material
  readiness requires them; do not generate tangents in the first mesh
  construction helper.

## Registry Handoff

The construction report should produce planned mesh source assets and
diagnostics only. A later registration helper can write successful mesh assets
into `AssetRegistry` using:

```text
mesh:gltf:mesh:<meshIndex>:primitive:<primitiveIndex>
```

Do not register inside construction. This keeps duplicate-key behavior,
dependency reporting, and ready-state transitions in the same explicit registry
handoff style already used for material/texture/sampler source assets.

## ECS Authoring Boundary

ECS authoring commands should consume registered mesh handles only after:

- mesh source asset construction succeeds;
- mesh source assets are registered or already available;
- primitive material resolution succeeds;
- scene/node traversal succeeds.

The mesh construction helper should not know about `Mesh` or `Material`
components, `Entity`, `WorldTransform`, render snapshots, or WebGPU buffers.

## Non-Goals

- No asset registry mutation.
- No ECS commands or entity references.
- No material resolution.
- No tangent generation.
- No morph target or skin construction.
- No multi-submesh aggregation.
- No WebGPU buffer upload.
- No render extraction.

## Follow-Up Slices

1. Implement typed-array decoding report.
2. Implement mesh source asset construction over decoded primitive arrays.
3. Add JSON fixture tests for mesh construction reports that summarize typed
   arrays instead of embedding full data.
4. Add mesh source asset registry registration after construction tests pass.
5. Audit the full mesh-source handoff before ECS command planning.
