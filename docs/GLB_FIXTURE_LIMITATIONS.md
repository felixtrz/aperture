# GLB Fixture Limitations

Updated: 2026-05-19

The current GLB path is a source-side fixture/import-report bridge. It is not a
full async file loader yet.

## Supported Now

- Parse GLB 2.0 containers with a JSON chunk and optional BIN chunk.
- Feed parsed JSON into the existing report-driven glTF import contract.
- Resolve GLB buffer `0` from the BIN chunk for mesh accessor decoding.
- Resolve URI buffers from caller-provided bytes through the fixture resolver
  contract. Mixed fixtures may use the BIN chunk for buffer `0` and resolver
  bytes for later external buffers.
- Surface structured diagnostics for invalid containers, missing BIN chunk
  bytes, and unsupported external buffers without caller-provided bytes.
- Project GLB import reports to JSON-safe summaries without raw `binaryChunk` or
  `jsonText` payloads, decoded image byte payloads, or caller-provided external
  buffer bytes.
- Project compact GLB source status for browser/example reporting. Malformed
  containers keep `byteLength: null`, empty chunk summaries, and empty
  `importStages` because import stages do not run.
- Use a no-fetch source-loader facade for tests that already have primary GLB
  bytes and optional external buffer bytes. The facade returns loader-style
  status plus the GLB import report, but it does not perform network or browser
  loading.
- Route the browser GLTF scene's inline fixture through the no-fetch facade so
  `source.glbFixture` reports loader-level `status`, `sourceKind`,
  `externalBuffers`, diagnostics, and nested compact GLB source status.
- Summarize no-fetch facade output with mesh-construction counts and validity
  when mesh construction is requested. These summaries are diagnostics and
  readiness data, not authoritative ECS state or renderer resources.
- Use caller-provided decoded image data for glTF images that reference
  `bufferView` sources.
- Publish JSON-safe GLB fixture status from the browser GLTF scene example.

## Deferred

- Async file/URL loading.
- External buffer URI fetching and dependency scheduling. Current resolver tests
  prove caller-provided bytes only; they do not fetch or schedule external URI
  dependencies.
- Loader cache, retry, reload, unload, and dependency lifecycle management.
- Built-in image decoding from bufferView bytes.
- Full Khronos glTF validation.
- Draco, meshopt, KTX2/Basis, WebP, AVIF, and other compressed asset paths.
- Full scene-loader lifecycle, cache, reload, and unload integration.

## Ownership Boundary

The GLB fixture path lives in `@aperture-engine/render` because it produces
renderer-independent source/import reports. It must not allocate GPU resources,
own ECS/game state, or become a hidden scene graph. ECS authoring still happens
through explicit import contracts and replayable authoring commands.

Source-loader output summaries are intentionally one step earlier than ECS
authoring. Source registration summaries and ECS command-plan summaries remain
deferred until those contracts are explicitly routed through the facade.
When a source-registration report is provided explicitly, the no-fetch facade can
summarize written/skipped/diagnostic counts, but it still does not mutate an
asset registry.

The browser GLTF scene currently publishes `outputSummary.meshConstruction` as
`absent` because its inline GLB fixture is used for source status and scene root
metadata, while the visible primitive meshes are still authored by the existing
fixture path. A future buffer-backed browser fixture can move this summary to
`ready` without changing the ECS/render ownership boundary.

The browser GLTF scene also publishes a separate
`source.bufferBackedGlbFixture` proof. That fixture uses real GLB BIN bytes for
one indexed triangle and reports a ready mesh-construction summary through the
no-fetch facade. It is source/import readiness proof only; it does not replace
the visible scene's current ECS authoring or rendering path.

## Next Practical Step

Continue with small fixture slices that harden the source/import contract before
adding async file loading. The no-fetch facade should remain the seam where
future fetch/decode work hands already loaded bytes into the same report
contract, rather than authoring ECS state or creating WebGPU resources directly.
