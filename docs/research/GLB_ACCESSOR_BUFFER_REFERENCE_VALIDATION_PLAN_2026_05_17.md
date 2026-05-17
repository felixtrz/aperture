# GLB Accessor And Buffer Reference Validation Plan - 2026-05-17

## Scope

Plan the renderer-independent validation layer between GLB mesh primitive
reference mapping and future typed-array decoding / `MeshAsset` construction.

This is a planning slice only. It must not decode binary buffers, allocate
typed vertex arrays, register mesh assets, author ECS entities, or touch WebGPU.

Reference anchors:

- `docs/research/MINIMAL_GLB_MESH_PRIMITIVE_SOURCE_MAPPING_PLAN_2026_05_17.md`
- `docs/research/GLB_CONTAINER_SLICE_PLAN_2026_05_16.md`
- `docs/research/MESH_GEOMETRY_COVERAGE.md`
- `docs/ARCHITECTURE.md`
- Bevy glTF attribute conversion in
  `references/bevy/crates/bevy_gltf/src/vertex_attributes.rs`
- Bevy primitive index reading in
  `references/bevy/crates/bevy_gltf/src/loader/mod.rs`
- three.js `GLTFLoader.loadBufferView` and `loadAccessor` dependency staging
- PlayCanvas `glb-parser` accessor data, stride, sparse, and vertex-buffer
  source descriptor paths

Common reference pattern: glTF geometry loading is staged through accessor and
bufferView dependencies before an engine-specific geometry object is created.
Aperture should borrow that staging, but the first contract should validate
references and byte ranges only. Decoding remains a later explicit step.

## Required Separation

Keep mesh source loading layered:

```text
GLB bytes / glTF JSON
  -> mesh primitive reference mapping report
  -> accessor/buffer reference validation report
  -> typed-array decoding report
  -> MeshAsset construction
  -> source asset registry registration
  -> ECS authoring command report
```

The accessor/buffer validation report may describe byte ranges and expected
formats. It should not expose `Float32Array`, `Uint16Array`, decoded vertex
streams, `MeshAsset`, ECS commands, or GPU buffers.

## Proposed Helper

Add a helper under `packages/render/src/assets` later:

```ts
validateGltfPrimitiveAccessorReferences(input): GltfAccessorValidationReport
```

Inputs:

- `root`: plain glTF JSON root object.
- `primitivePlan`: one `GltfPlannedMeshPrimitiveAsset` or a list of planned
  primitive references from `createGltfMeshPrimitiveMappingReport`.
- `binaryChunkByteLength`: optional byte length for GLB BIN chunk validation.
- `externalBufferByteLengths`: optional map from buffer index to byte length for
  caller-resolved external buffers. URI fetching remains out of scope.

The helper should accept byte lengths, not byte contents. This is enough to
validate ranges while keeping decoding and I/O out of the report.

## Report Shape

Minimal report:

```ts
interface GltfAccessorValidationReport {
  readonly valid: boolean;
  readonly primitives: readonly GltfPrimitiveAccessorPlan[];
  readonly diagnostics: readonly GltfAccessorValidationDiagnostic[];
}

interface GltfPrimitiveAccessorPlan {
  readonly meshHandleKey: string;
  readonly meshIndex: number;
  readonly primitiveIndex: number;
  readonly vertexCount: number | null;
  readonly attributes: readonly GltfValidatedAccessorReference[];
  readonly indices: GltfValidatedIndexReference | null;
}
```

Accessor references should include:

- semantic (`POSITION`, `NORMAL`, `TEXCOORD_0`, or `INDICES`);
- accessor index;
- bufferView index;
- buffer index;
- resolved byte range `{ offset, length }`;
- component type;
- accessor type;
- count;
- byte stride;
- normalized flag;
- expected Aperture vertex/index format for later decoding.

The report should be JSON-safe and stable. It should not embed raw binary data.

## Buffer Validation

Validate root `buffers[]`:

- `buffers` must be an array when accessor validation is requested.
- Each referenced buffer must be an object.
- `byteLength` must be a non-negative integer.
- GLB BIN buffer references should not exceed the provided
  `binaryChunkByteLength` when the buffer has no external URI or when the caller
  marks it as the GLB binary buffer.
- External buffer URI resolution is deferred. If a referenced external buffer
  has no caller-provided byte length, emit a diagnostic such as
  `gltfAccessor.externalBufferUnresolved`.

Do not fetch `uri`, parse data URLs, or read files in this helper.

## BufferView Validation

Validate root `bufferViews[]`:

- `bufferViews` must be an array.
- Each referenced bufferView must be an object.
- `buffer` must reference a valid buffer index.
- `byteOffset` defaults to `0` and must be a non-negative integer.
- `byteLength` must be a non-negative integer.
- `byteOffset + byteLength` must fit inside the referenced buffer byte length
  when known.
- `byteStride`, when present, must be a positive integer and large enough for
  the accessor element size.
- `byteStride` must respect glTF alignment rules for vertex attributes. The
  first validator can diagnose alignment conservatively and leave exact stride
  normalization to decoding.

BufferView `target` should be preserved as metadata, but it should not be
trusted as the source of truth for whether data is vertex or index data. The
primitive/accessor semantic determines that.

## Accessor Validation

Validate root `accessors[]`:

- `accessors` must be an array.
- Each referenced accessor must be an object.
- `componentType` must be one of glTF 2.0 numeric component types:
  - `5120` signed byte
  - `5121` unsigned byte
  - `5122` signed short
  - `5123` unsigned short
  - `5125` unsigned int
  - `5126` float
- `type` must be a known accessor type: `SCALAR`, `VEC2`, `VEC3`, `VEC4`,
  `MAT2`, `MAT3`, or `MAT4`.
- `count` must be a non-negative integer.
- `byteOffset` defaults to `0` and must be a non-negative integer.
- Referenced `bufferView` must be in range when present.
- Accessors without `bufferView` are valid only for zero-filled non-sparse data
  or sparse base data. The first mesh path should reject them for renderable
  vertex/index streams unless a later zero-fill policy is explicitly added.
- Sparse accessors should be diagnosed as deferred with
  `gltfAccessor.sparseAccessorDeferred`. three.js and PlayCanvas both support
  sparse patching, but Aperture should add it only as a later decoding task.
- Accessor byte ranges must fit inside the resolved bufferView range:
  `byteOffset + stride * (count - 1) + elementByteSize <= bufferView.byteLength`
  for strided data, or `byteOffset + count * elementByteSize <= byteLength` for
  tightly packed data.

## Mesh Semantic Validation

For the first mesh source path:

- `POSITION`
  - Required by `createGltfMeshPrimitiveMappingReport`.
  - Accessor `type` must be `VEC3`.
  - Component type should be `5126` float for the first decoder path.
  - Quantized integer positions should be diagnosed as deferred unless
    `KHR_mesh_quantization` support is explicitly added.
  - `min` and `max` should be validated as 3-number tuples when present.
- `NORMAL`
  - Optional.
  - Accessor `type` must be `VEC3`.
  - Component type should be `5126` float for the first decoder path.
  - Missing normals should remain valid for unlit content and become a material
    readiness concern for lit materials.
- `TEXCOORD_0`
  - Optional.
  - Accessor `type` must be `VEC2`.
  - Component type should be `5126` float for the first decoder path.
  - Integer or normalized UVs can be a later decoding feature.
- indices
  - Optional.
  - Accessor `type` must be `SCALAR`.
  - Component type may be `5121`, `5123`, or `5125`.
  - Future decoding should canonicalize `5121` (`uint8`) indices to
    `uint16`, matching Aperture's `MeshIndexBufferDescriptor` and WebGPU
    support.
  - Validation should check index accessor count and byte range, but actual
    index values are checked only after decoding.

## Diagnostics

Diagnostics should be JSON-safe and preserve primitive/accessor context:

- `gltfAccessor.malformedBuffers`
- `gltfAccessor.invalidBuffer`
- `gltfAccessor.externalBufferUnresolved`
- `gltfAccessor.bufferRangeOutOfBounds`
- `gltfAccessor.malformedBufferViews`
- `gltfAccessor.invalidBufferView`
- `gltfAccessor.invalidByteStride`
- `gltfAccessor.accessorRangeOutOfBounds`
- `gltfAccessor.malformedAccessors`
- `gltfAccessor.invalidAccessor`
- `gltfAccessor.unsupportedComponentType`
- `gltfAccessor.unsupportedAccessorType`
- `gltfAccessor.unsupportedSemanticFormat`
- `gltfAccessor.sparseAccessorDeferred`
- `gltfAccessor.zeroFillAccessorDeferred`

Diagnostic fields should include where possible:

- `meshHandleKey`
- `meshIndex`
- `primitiveIndex`
- `semantic`
- `accessorIndex`
- `bufferViewIndex`
- `bufferIndex`
- `field`
- `value`
- `byteOffset`
- `byteLength`
- `requiredByteLength`

## Non-Goals

- No GLB byte parsing.
- No external URI fetching or data URL decoding.
- No `Float32Array`, `Uint16Array`, or `Uint32Array` creation.
- No sparse accessor patching.
- No quantization/dequantization.
- No bounds computation from decoded positions.
- No `MeshAsset` construction.
- No asset registry writes.
- No ECS authoring commands.
- No render extraction or WebGPU upload.

## Follow-Up Slices

1. Implement the accessor/buffer reference validation report over mesh primitive
   mapping output.
2. Add JSON fixture tests for range diagnostics and semantic format diagnostics.
3. Plan typed-array decoding separately, including `uint8` index
   canonicalization and stride flattening.
4. Add `MeshAsset` construction only after decoded source arrays and bounds have
   an explicit report contract.
