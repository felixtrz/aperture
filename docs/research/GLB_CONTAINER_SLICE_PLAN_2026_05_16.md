# GLB Container Slice Plan — 2026-05-16

## Scope

Plan the first renderer-independent GLB-only loader foundation. This is a
container and diagnostics slice only. It must not create renderer objects,
WebGPU resources, a hidden scene graph, or premature glTF material mapping.

The purpose is to make future GLB work testable while keeping the current
priority on StandardMaterial PBR and the generic render pipeline/material queue.

## References Inspected

- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/ASSET_LOADER_SCENE_IMPORT_COVERAGE.md`
- `references/engine/src/framework/parsers/glb-parser.js`
- `references/engine/src/framework/parsers/glb-container-parser.js`
- `references/three.js/examples/jsm/loaders/GLTFLoader.js`
- `references/bevy/crates/bevy_gltf/src/loader/mod.rs`

## Proven Patterns To Borrow

- PlayCanvas separates container loading from the resource/container wrapper and
  reports invalid GLB/glTF structure as explicit errors.
- three.js first distinguishes JSON `.gltf` from binary `.glb`, validates the
  binary header, extracts JSON and BIN chunks, and ignores unknown chunks after
  known data rather than creating renderer resources in the parser.
- Bevy keeps glTF loading inside the asset pipeline, labels sub-assets, and
  loads buffers/materials/nodes as data assets before rendering. Aperture should
  preserve this source-asset-first shape, but return handles/reports rather than
  spawning a scene graph.

## GLB 2.0 Container Contract

The first parser should accept an `ArrayBuffer` or `Uint8Array` and produce a
plain data result:

```ts
interface GlbContainerParseResult {
  readonly ok: boolean;
  readonly container: GlbContainer | null;
  readonly diagnostics: readonly GlbContainerDiagnostic[];
}

interface GlbContainer {
  readonly version: 2;
  readonly byteLength: number;
  readonly json: unknown;
  readonly jsonText: string;
  readonly binaryChunk: Uint8Array | null;
  readonly chunks: readonly GlbChunkInfo[];
}

interface GlbChunkInfo {
  readonly type: "json" | "bin" | "unknown";
  readonly typeCode: number;
  readonly byteOffset: number;
  readonly byteLength: number;
}
```

Required validation:

- Minimum 12-byte header.
- Header magic must be `0x46546c67` (`glTF`, little-endian).
- Header version must be `2`.
- Header length must equal the provided byte length.
- Chunk headers are 8 bytes each: `uint32 length`, `uint32 type`.
- The first chunk must be JSON (`0x4e4f534a`).
- JSON chunk length must be non-zero and within bounds.
- JSON text must decode as UTF-8 and parse to an object.
- Optional BIN chunk type is `0x004e4942`.
- Chunk byte ranges must not exceed the declared GLB byte length.
- Padding bytes should be tolerated; diagnostics should name malformed ranges.

Initial behavior for unknown chunks:

- Unknown chunks after JSON/BIN should be preserved in `chunks` and reported as
  a warning diagnostic, not treated as renderer state.
- Unknown first chunk is an error because the JSON root is required.

## Diagnostics

Use JSON-safe diagnostics with stable codes and offsets:

```ts
type GlbContainerDiagnosticCode =
  | "glb.tooShort"
  | "glb.invalidMagic"
  | "glb.unsupportedVersion"
  | "glb.lengthMismatch"
  | "glb.missingJsonChunk"
  | "glb.invalidChunkHeader"
  | "glb.chunkOutOfBounds"
  | "glb.emptyJsonChunk"
  | "glb.invalidJson"
  | "glb.unknownChunk";

interface GlbContainerDiagnostic {
  readonly code: GlbContainerDiagnosticCode;
  readonly message: string;
  readonly severity: "error" | "warning";
  readonly byteOffset?: number;
  readonly byteLength?: number;
  readonly chunkType?: number;
}
```

The parser should return `ok: false` if any error severity diagnostic exists and
`container: null` in that case. It should not throw for malformed user content.

## Package Boundary

Place the first implementation in a renderer-independent package, most likely
`@aperture-engine/render`, because it is the package that owns mesh/material/
texture source asset contracts and import-facing diagnostics. The implementation
must not import `@aperture-engine/webgpu`, browser APIs, DOM types, fetch, or
image decoders.

## Explicit Non-Goals

- No `.gltf` URI loading.
- No network/file fetching.
- No image decoding.
- No bufferView/accessor decoding.
- No mesh/material/texture asset creation.
- No ECS authoring commands.
- No scene/prefab instantiation.
- No Draco, Meshopt, KTX2/Basis, WebP, AVIF, sparse accessors, animation,
  skinning, morphs, or extension processing.
- No OBJ, FBX, STL, USD, or any non-glTF import format.

## Follow-Up Sequence

1. Implement and test the GLB container parser and diagnostics.
2. Add a glTF JSON root validation slice for `asset.version === "2.0"` and
   required/unsupported extension diagnostics.
3. Add buffer/bufferView/accessor bounds validation without typed asset mapping.
4. After StandardMaterial texture paths and the generic render queue are ready,
   add typed asset mapping for a minimal uncompressed GLB triangle.

GLB viewer work should wait until StandardMaterial PBR is complete enough to map
glTF metallic-roughness materials honestly.
