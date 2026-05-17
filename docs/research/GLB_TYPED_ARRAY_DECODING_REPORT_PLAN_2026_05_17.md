# GLB Typed-Array Decoding Report Plan - 2026-05-17

## Scope

Plan the renderer-independent decoding stage that should follow accessor/buffer
reference validation and precede `MeshAsset` construction.

This is a planning slice only. It must not construct `MeshAsset`s, mutate the
asset registry, author ECS entities, create render snapshots, or touch WebGPU.

Reference anchors:

- `docs/research/GLB_ACCESSOR_BUFFER_REFERENCE_VALIDATION_PLAN_2026_05_17.md`
- `docs/research/MESH_GEOMETRY_COVERAGE.md`
- `packages/render/src/assets/gltf-accessor-validation.ts`
- three.js `GLTFLoader.loadAccessor` interleaved and sparse accessor staging
- PlayCanvas `glb-parser` strided accessor flattening and index extraction
- Bevy glTF attribute conversion in
  `references/bevy/crates/bevy_gltf/src/vertex_attributes.rs`

Common reference pattern: engines turn validated accessor metadata into
engine-native typed arrays before geometry construction. Aperture should keep
that as a separate report so bytes, decoding diagnostics, mesh construction,
registry writes, and ECS authoring remain independently inspectable.

## Proposed Helper

Add later under `packages/render/src/assets`:

```ts
decodeGltfPrimitiveAccessors(input): GltfAccessorDecodingReport
```

Inputs:

- `validationReport`: `GltfAccessorValidationReport`.
- `resolveBufferBytes`: caller-owned resolver from buffer index to `Uint8Array`
  or `ArrayBufferView`.
- `copyPolicy`: optional `"copy"` default. Zero-copy views can be considered
  later only if lifetimes are explicit.

The helper may create typed arrays from caller-provided bytes, but it should not
fetch URIs, parse data URLs, or read files.

## Report Shape

```ts
interface GltfAccessorDecodingReport {
  readonly valid: boolean;
  readonly primitives: readonly GltfDecodedPrimitiveAccessors[];
  readonly diagnostics: readonly GltfAccessorDecodingDiagnostic[];
}

interface GltfDecodedPrimitiveAccessors {
  readonly meshHandleKey: string;
  readonly meshIndex: number;
  readonly primitiveIndex: number;
  readonly vertexCount: number;
  readonly attributes: readonly GltfDecodedAttribute[];
  readonly indices: GltfDecodedIndexBuffer | null;
}
```

Decoded entries should preserve semantic, accessor index, source byte range,
source component type, output format, count, and normalized flag. JSON helpers
should summarize array type and length, not embed raw numeric arrays by default.

## Decoding Rules

Tightly packed accessors:

- Create a typed output array with exactly `count * componentCount` elements.
- Copy bytes from the resolved source buffer range.
- Validate the source buffer is available and large enough even though the
  previous validation stage should already have checked ranges.

Strided bufferViews:

- Flatten into tightly packed output arrays.
- Copy one accessor element at a time using `byteStride` and element byte size.
- Preserve the original stride in the report for diagnostics.

Indices:

- `5121` unsigned byte source indices decode into `Uint16Array`.
- `5123` unsigned short source indices decode into `Uint16Array`.
- `5125` unsigned int source indices decode into `Uint32Array`.
- Index value range validation can remain part of the later `MeshAsset`
  construction stage because it depends on decoded vertex count.

Attributes:

- `POSITION`: output `Float32Array`, item size 3.
- `NORMAL`: output `Float32Array`, item size 3.
- `TEXCOORD_0`: output `Float32Array`, item size 2.

## Deferred Cases

The first decoder should not silently implement broader glTF behavior:

- Sparse accessors remain deferred.
- Quantized integer position/normal/UV data remains deferred.
- Normalized integer vertex attributes remain deferred.
- Matrix accessors are not part of the mesh primitive path.
- Tangents, colors, joints, weights, morph targets, and secondary UVs are later
  feature slices.

## Diagnostics

Diagnostics should be JSON-safe and source-indexed:

- `gltfDecode.missingBufferBytes`
- `gltfDecode.sourceRangeOutOfBounds`
- `gltfDecode.unsupportedSparseAccessor`
- `gltfDecode.unsupportedQuantizedAttribute`
- `gltfDecode.unsupportedNormalizedAttribute`
- `gltfDecode.unsupportedOutputFormat`
- `gltfDecode.strideCopyFailed`

Include where possible:

- `meshHandleKey`
- `meshIndex`
- `primitiveIndex`
- `semantic`
- `accessorIndex`
- `bufferIndex`
- `byteOffset`
- `byteLength`
- `expectedFormat`
- `arrayType`

## JSON Expectations

JSON helpers should report:

- primitive identity;
- semantic and accessor identity;
- array constructor name (`Float32Array`, `Uint16Array`, `Uint32Array`);
- element length;
- item size;
- source byte range;
- diagnostics.

Do not embed full typed-array contents in JSON fixture reports unless a later
debug-specific helper explicitly opts in.

## Non-Goals

- No URI fetching or data URL decoding.
- No sparse accessor patching.
- No quantization or normalized integer conversion.
- No `MeshAsset` construction.
- No local bounds computation.
- No asset registry writes.
- No ECS authoring commands.
- No render extraction or WebGPU upload.

## Follow-Up Slices

1. Implement typed-array decoding over validated accessor references.
2. Add JSON fixture tests that prove array summaries omit raw data.
3. Plan `MeshAsset` construction from decoded arrays and bounds.
