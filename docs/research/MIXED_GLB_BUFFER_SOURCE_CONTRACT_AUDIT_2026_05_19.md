# Mixed GLB Buffer Source Contract Audit 2026-05-19

## Scope

Audited the mixed GLB BIN plus caller-resolved external-buffer path after
resolver behavior, JSON projection coverage, resolver docs, and malformed
diagnostic JSON projection coverage.

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/ASSET_LOADER_SCENE_IMPORT_COVERAGE.md`
- `docs/research/GLB_PARSER_DIAGNOSTICS_AFTER_CHUNK_ORDERING_AUDIT_2026_05_19.md`
- `references/bevy/crates/bevy_gltf/src/loader/mod.rs`
- `references/engine/src/framework/parsers/glb-parser.js`
- `references/three.js/examples/jsm/loaders/GLTFLoader.js`
- `packages/render/src/assets/gltf-report-driven-import.ts`
- `test/assets/glb-container.test.ts`

## Findings

- The wrapper now distinguishes BIN-backed buffer `0` from URI-backed external
  buffers before consulting the caller resolver. This avoids treating the
  resolver as an implicit override for the GLB BIN chunk.
- Mixed fixtures are covered: POSITION data can come from the GLB BIN chunk
  while index data comes from caller-provided bytes for a second URI buffer.
- Missing external bytes produce `glbImport.externalBufferUnsupported` for the
  URI buffer while BIN-backed buffer `0` remains available. This keeps missing
  external data distinct from `glbImport.missingBinaryChunk`.
- JSON projections for externally resolved buffers summarize mesh data shapes
  without serializing raw BIN bytes or caller-provided external bytes.
- Malformed chunk-ordering diagnostics preserve structured codes, offsets,
  lengths, and chunk types in JSON, and invalid containers do not run import
  stages.

## Architecture Check

- Source parsing and buffer resolution remain in `@aperture-engine/render`,
  which is still renderer-independent and headless-safe.
- The resolver contract does not fetch, decode images, mutate ECS state, or
  allocate GPU resources.
- The browser-facing status path remains JSON-safe. Raw source bytes and decoded
  payloads are omitted from JSON projections.
- The current path is still a fixture/import-report bridge, not a full loader
  lifecycle with fetch, dependency scheduling, cache, reload, or unload.

## Recommendation

Next task: add a compact GLB source-status projection helper in
`@aperture-engine/render` and use it in the browser GLTF scene. The example
currently hand-builds a similar status object; moving that to a tested helper
would reduce drift between tests, docs, and browser status while preserving the
same JSON-safe boundary.
