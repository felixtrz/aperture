# Browser Source Loader Facade Adoption Audit 2026-05-19

## Scope

Audited the browser GLTF scene after routing its inline GLB fixture through the
no-fetch source-loader facade and adding Playwright source-status assertions.

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/SOURCE_LOADER_BOUNDARY_PLAN_AND_FACADE_AUDIT_2026_05_19.md`
- `examples/gltf-scene.js`
- `examples/gltf-scene-source-status.md`
- `packages/render/src/assets/glb-source-loader-facade.ts`
- `test/e2e/gltf-scene.spec.ts`
- `test/assets/glb-source-loader-facade.test.ts`

## Findings

- The browser GLTF scene now uses `createNoFetchGlbSourceLoaderReport` for its
  inline GLB fixture. The parsed root still comes from the GLB import report and
  feeds the existing ECS authoring path.
- `source.glbFixture` now exposes loader-level status:
  `status`, `sourceKind`, primary `byteLength`, `externalBuffers`,
  diagnostics, and nested compact `glbSourceStatus`.
- Playwright status assertions now check `status: "loaded"`,
  `sourceKind: "glb"`, empty external buffers, nested compact GLB validity, and
  absence of raw `binaryChunk`, `jsonText`, and `Uint8Array` strings.
- The no-fetch facade still does not fetch, decode images, mutate ECS state,
  allocate WebGPU resources, or create scene graph ownership.
- Malformed chunk-ordering diagnostics are covered at the facade-status level.

## Architecture Check

- ECS authority is preserved. The example still authors ECS through parsed
  source data and existing import/authoring contracts.
- Rendering remains derived. Loader status does not feed render queues or GPU
  resources.
- Browser status remains JSON-safe and does not claim full file loading.
- The path is now better aligned for a later async loader because source status,
  source bytes, and import reports have a tested boundary.

## Recommendation

Next task: plan the next scene-source contract slice after the no-fetch facade.
The best candidate is a docs/test plan for moving the browser GLTF scene from
using only the parsed root toward consuming a report-driven source-loader output
object that can later carry asset mapping, mesh construction, source
registration, and ECS command plans without changing renderer ownership.
