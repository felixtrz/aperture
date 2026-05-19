# GLB Parser Diagnostics After Chunk Ordering Audit 2026-05-19

## Scope

Audited the GLB container and wrapper tests after malformed chunk-ordering,
bufferView image JSON serialization, source-status docs, and external-buffer
resolver contract coverage.

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/research/GLB_CONTAINER_SLICE_PLAN_2026_05_16.md`
- `docs/research/ASSET_LOADER_SCENE_IMPORT_COVERAGE.md`
- `references/engine/src/framework/parsers/glb-parser.js`
- `references/three.js/examples/jsm/loaders/GLTFLoader.js`
- `packages/render/src/assets/glb-container.ts`
- `packages/render/src/assets/gltf-report-driven-import.ts`
- `test/assets/glb-container.test.ts`

## Findings

- Malformed container input remains non-throwing. Invalid headers, truncated
  chunks, out-of-bounds chunks, BIN-before-JSON ordering, duplicate JSON chunks,
  duplicate BIN chunks, invalid JSON, and missing JSON all return structured
  diagnostics with `container: null`.
- Valid JSON-only and JSON+BIN fixtures still pass through the parser and the
  report-driven import wrapper.
- The GLB wrapper remains source-side and renderer-independent. It does not
  author ECS state, allocate WebGPU resources, decode images, or perform async
  file loading.
- JSON projections omit raw GLB bytes, `jsonText`, and decoded image byte
  payloads while preserving chunk summaries, texture handle keys, material
  bindings, and diagnostics.
- Caller-provided external buffer bytes now have explicit regression coverage.
  Missing resolver bytes still produce `glbImport.externalBufferUnsupported`,
  while provided bytes satisfy accessor decoding without wrapper diagnostics.
- The external-buffer resolver cache is covered for repeated references to the
  same buffer index.

## Architecture Check

- ECS authority is preserved: the parser and import wrapper produce source and
  import reports only.
- Render extraction boundaries are preserved: no renderer reads ECS directly,
  and no source loader state becomes render-world state.
- WebGPU ownership is preserved: GPU resources remain in `@aperture-engine/webgpu`.
- Diagnostics remain JSON-safe and stable enough for browser status surfaces.

## Recommendation

Next task: add mixed GLB BIN plus external-buffer resolver coverage. The focused
gap is a source fixture with buffer `0` supplied by the GLB BIN chunk and a
second URI buffer supplied by the caller resolver, proving the wrapper resolves
only the external buffer while preserving JSON-safe diagnostics.
