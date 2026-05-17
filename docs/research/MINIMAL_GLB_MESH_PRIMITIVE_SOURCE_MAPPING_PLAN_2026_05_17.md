# Minimal GLB Mesh Primitive Source Mapping Plan - 2026-05-17

## Scope

Plan the smallest renderer-independent mesh primitive report that can bridge the
existing GLB root/material/texture/source-registration work to future ECS
authoring without decoding buffers, mutating an ECS world, or touching WebGPU.

This is a planning slice only. It must not implement a loader, decode accessors,
register assets, create render snapshots, or create GPU resources.

Reference anchors:

- `docs/research/ASSET_LOADER_SCENE_IMPORT_COVERAGE.md`
- `docs/research/GLB_CONTAINER_SLICE_PLAN_2026_05_16.md`
- `docs/research/GLB_ECS_AUTHORING_COMMAND_HANDOFF_PLAN_2026_05_17.md`
- `docs/research/MESH_GEOMETRY_COVERAGE.md`
- `docs/ARCHITECTURE.md`
- Bevy glTF primitive loading and labeled primitive sub-assets in
  `references/bevy/crates/bevy_gltf/src/loader/mod.rs`
- Bevy primitive topology mapping in
  `references/bevy/crates/bevy_gltf/src/loader/gltf_ext/mesh.rs`
- three.js `GLTFLoader` primitive geometry dependency loading and bounds
  extraction in `references/three.js/examples/jsm/loaders/GLTFLoader.js`
- PlayCanvas GLB mesh creation in
  `references/engine/src/framework/parsers/glb-parser.js`

Common reference pattern: reference engines treat each glTF mesh primitive as a
distinct renderable geometry/sub-asset, map glTF primitive mode to engine
topology, read attributes and optional indices through accessor dependencies,
and connect material indices later during scene/entity creation. Aperture should
borrow the sub-asset identity and dependency staging, but keep the result as a
plain report over source data rather than creating scene objects or GPU buffers.

## Required Separation

Keep the GLB mesh path layered:

```text
GLB bytes / glTF JSON
  -> root validation
  -> mesh primitive reference mapping report
  -> accessor/buffer decoding report
  -> mesh source asset construction
  -> source asset registry registration
  -> ECS authoring command report
  -> render extraction / WebGPU preparation
```

`task-0676` should implement only the reference mapping report. Accessor byte
decoding may be represented as an unresolved dependency diagnostic, not hidden
inside the mapper.

## Deterministic Handle Strategy

Use the same import-local key pattern already planned for ECS primitive
authoring:

```text
gltf:mesh:<meshIndex>:primitive:<primitiveIndex>
```

The future registry write should turn that id into the full mesh handle key:

```text
mesh:gltf:mesh:<meshIndex>:primitive:<primitiveIndex>
```

The mapping report should preserve both the source indices and the planned mesh
handle id/key so later source registration and ECS commands can reference the
same primitive without re-deriving identity.

Optional `keyPrefix` should default to `gltf` and produce:

```text
<keyPrefix>:mesh:<meshIndex>:primitive:<primitiveIndex>
```

## Minimal Report Shape

Proposed helper:

```ts
createGltfMeshPrimitiveMappingReport(input): GltfMeshPrimitiveMappingReport
```

Inputs:

- `root`: plain glTF JSON root object.
- `meshPrimitiveIndices`: optional explicit `{ meshIndex, primitiveIndex }[]`.
  When omitted, iterate every primitive in every `meshes[]` entry.
- `keyPrefix`: optional deterministic prefix, defaulting to `gltf`.
- `accessorData`: optional report/resolver result from a later accessor decoding
  slice. The first implementation may omit this and emit unresolved data
  diagnostics while still preserving reference metadata.

Report:

```ts
interface GltfMeshPrimitiveMappingReport {
  readonly valid: boolean;
  readonly root: GltfRootValidationReportJsonValue;
  readonly meshes: readonly GltfPlannedMeshPrimitiveAsset[];
  readonly diagnostics: readonly GltfMeshPrimitiveMappingDiagnostic[];
}

interface GltfPlannedMeshPrimitiveAsset {
  readonly handleKey: string;
  readonly registeredHandleKey: string;
  readonly meshIndex: number;
  readonly primitiveIndex: number;
  readonly label: string;
  readonly topology: "triangle-list";
  readonly attributes: GltfMeshPrimitiveAttributeReferences;
  readonly indices: GltfMeshPrimitiveIndexReference | null;
  readonly materialIndex: number | null;
  readonly mesh: MeshAsset | null;
}
```

`mesh` should remain `null` until every required decoded accessor payload is
available and validated. The first skeleton can therefore prove deterministic
handle planning and diagnostics without pretending it has built a source mesh.

## Reference Validation vs Decoding

Reference validation answers whether the glTF JSON points at a plausible mesh
primitive:

- `meshes` is an array.
- `meshIndex` is in range.
- `mesh.primitives` is an array.
- `primitiveIndex` is in range.
- `primitive.attributes` is an object.
- `primitive.attributes.POSITION` is present and references an accessor index.
- Optional `NORMAL` and `TEXCOORD_0` reference accessor indices when present.
- Optional `indices` references an accessor index when present.
- `mode` is omitted or `4` (`TRIANGLES`) for the first supported path.
- Optional `material` is either absent or references an integer material index.

Accessor/buffer decoding answers whether bytes can become `MeshAsset` streams:

- Accessor `componentType`, `type`, `count`, `normalized`, and sparse state.
- Buffer view range, byte stride, byte offsets, and binary chunk/source bytes.
- `POSITION` conversion to `float32x3`.
- `NORMAL` conversion to `float32x3`.
- `TEXCOORD_0` conversion to `float32x2`.
- Optional index conversion to `uint16` or `uint32`, including `uint8` to
  `uint16` canonicalization for WebGPU.
- Local AABB/sphere computation from decoded positions when accessor min/max is
  missing or not trusted.

The first mesh primitive mapper should not perform the decoding work. It should
emit `gltfMesh.unresolvedAccessorData` for otherwise valid primitives when
decoded data is not provided.

## Supported Primitive MVP

The first source mapping path should cover only renderable triangle-list
primitives:

- Required `POSITION`.
- Optional `NORMAL`.
- Optional `TEXCOORD_0`.
- Optional `indices`.
- Optional `material` index preserved for later primitive-to-material
  resolution.

The initial `MeshAsset` construction path, when added later, should produce:

- One interleaved or tightly packed vertex stream with supported attributes.
- An optional index buffer.
- One submesh with `topology: "triangle-list"`, `materialSlot: 0`,
  `vertexStart: 0`, and ranges derived from decoded data.
- One material slot carrying a deterministic label.
- Local bounds from position data.

Do not import or fabricate `TANGENT`, `COLOR_0`, `TEXCOORD_1`, joints, weights,
morph targets, or skins in the first report skeleton. These can be preserved by
later diagnostics or schema extensions once StandardMaterial and animation
requirements need them.

## Unsupported Or Deferred Cases

Diagnostics should be JSON-safe and source-indexed:

- `gltfMesh.malformedMeshes`
- `gltfMesh.missingMesh`
- `gltfMesh.malformedPrimitives`
- `gltfMesh.missingPrimitive`
- `gltfMesh.malformedPrimitive`
- `gltfMesh.missingPosition`
- `gltfMesh.invalidAccessorReference`
- `gltfMesh.unsupportedPrimitiveMode`
- `gltfMesh.unsupportedCompressedPrimitive`
- `gltfMesh.unresolvedAccessorData`

For MVP, unsupported primitive modes include points, lines, line strips, line
loops, triangle strips, and triangle fans. Bevy, three.js, and PlayCanvas all
support or convert more modes, but Aperture's first GLB mesh source asset path
should stay on `TRIANGLES` until line/point materials and strip/fan conversion
are explicit tasks.

`KHR_draco_mesh_compression`, `EXT_meshopt_compression`, sparse accessors,
morph targets, skins, and material variants should be diagnostics or later
extension points, not silent partial imports.

## JSON Expectations

The JSON helper should preserve:

- `valid`.
- Root validation JSON.
- Planned mesh handle keys.
- Mesh and primitive source indices.
- Attribute accessor references.
- Optional index accessor references.
- Optional material index.
- Topology.
- Diagnostics.

It must not embed raw decoded accessor arrays, GLB binary chunks, buffer views,
or GPU resources.

## Non-Goals

- No GLB byte parsing.
- No `.gltf` URI loading.
- No external buffer fetching.
- No accessor or bufferView decoding.
- No mesh source asset registration.
- No ECS entity, transform, or component authoring.
- No material registration or default material creation.
- No image decoding.
- No render extraction or render snapshot creation.
- No WebGPU resource preparation.

## Follow-Up Slices

1. Add the mesh primitive mapping report skeleton with deterministic keys and
   reference diagnostics.
2. Add JSON stability tests for the mesh primitive mapping report.
3. Plan and implement accessor/buffer bounds validation separately from typed
   mesh asset construction.
4. Add mesh source asset construction only after decoded accessor data has an
   explicit report contract.
5. Connect mesh source registration to ECS authoring commands only after mesh
   handles, material handles, scene traversal, and node transforms can all be
   resolved honestly.
