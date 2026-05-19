# GLB Fixture Source Status Audit 2026-05-19

## Scope

Audit the GLB fixture bridge after buffer-source diagnostics, JSON-safe report
serialization, browser source status, and bufferView image asset-mapping
coverage.

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/research/ASSET_LOADER_SCENE_IMPORT_COVERAGE.md`
- `references/bevy/crates/bevy_gltf/src/loader/mod.rs`
- `packages/render/src/assets/gltf-report-driven-import.ts`
- `packages/render/src/assets/gltf-asset-mapping.ts`
- `test/assets/glb-container.test.ts`
- `examples/gltf-scene.js`

## Findings

- GLB container parsing and import wrapping remain in `@aperture-engine/render`,
  which keeps the feature headless-safe and renderer-independent.
- GLB diagnostics remain source-side. Missing BIN chunk bytes and unsupported
  external buffer URIs are reported by the GLB wrapper before or alongside the
  existing accessor/asset mapping reports.
- The JSON projection omits `binaryChunk` and `jsonText`, preserving chunk
  summaries, container diagnostics, wrapper diagnostics, and import report
  summaries without exposing raw payloads.
- The browser GLTF scene status exposes only JSON-safe source facts:
  validity, byte length, chunk summaries, diagnostics, and import stages.
- The new bufferView image fixture still depends on caller-provided decoded
  image data; it does not imply built-in image decoding, async file loading,
  external URI resolution, validator integration, or compressed asset support.
- Package ownership remains aligned with the North Star: the GLB path produces
  source/import reports and asset mapping output, not renderer-owned ECS state
  or GPU resources.

## Deferred Work

- Full GLB/glTF file loading remains deferred.
- External buffer URI resolution remains caller-provided.
- Image decoding from bufferView bytes remains caller-provided.
- Compression paths such as Draco, meshopt, KTX2/Basis, WebP, and AVIF remain
  deferred.
- The next source fixture gap is indexed mesh coverage through the GLB wrapper.

## Recommendation

Next task: add minimal GLB index-buffer fixture coverage so POSITION plus
unsigned-short indices decode through the same report-driven import path while
JSON projections continue to avoid raw bytes.
