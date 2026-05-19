# GLB Fixture Limitations

Updated: 2026-05-19

The current GLB path is a source-side fixture/import-report bridge. It is not a
full async file loader yet.

## Supported Now

- Parse GLB 2.0 containers with a JSON chunk and optional BIN chunk.
- Feed parsed JSON into the existing report-driven glTF import contract.
- Resolve GLB buffer `0` from the BIN chunk for mesh accessor decoding.
- Surface structured diagnostics for invalid containers, missing BIN chunk
  bytes, and unsupported external buffers without caller-provided bytes.
- Project GLB import reports to JSON-safe summaries without raw `binaryChunk` or
  `jsonText` payloads.
- Use caller-provided decoded image data for glTF images that reference
  `bufferView` sources.
- Publish JSON-safe GLB fixture status from the browser GLTF scene example.

## Deferred

- Async file/URL loading.
- External buffer URI fetching and dependency scheduling.
- Built-in image decoding from bufferView bytes.
- Full Khronos glTF validation.
- Draco, meshopt, KTX2/Basis, WebP, AVIF, and other compressed asset paths.
- Full scene-loader lifecycle, cache, reload, and unload integration.

## Ownership Boundary

The GLB fixture path lives in `@aperture-engine/render` because it produces
renderer-independent source/import reports. It must not allocate GPU resources,
own ECS/game state, or become a hidden scene graph. ECS authoring still happens
through explicit import contracts and replayable authoring commands.

## Next Practical Step

Continue with small fixture slices that harden the source/import contract before
adding async file loading. Useful next slices include malformed chunk ordering,
image bufferView JSON serialization, and external-buffer resolver contracts.
