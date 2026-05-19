# Source Loader Boundary Plan And Facade Audit 2026-05-19

## Scope

Audited the async GLB source-loader boundary plan, JSON-safe loader status
shape, no-fetch fixture facade, and docs after `task-1923` through `task-1926`.

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/ASYNC_GLB_SOURCE_LOADER_BOUNDARY_PLAN_2026_05_19.md`
- `docs/GLB_FIXTURE_LIMITATIONS.md`
- `examples/gltf-scene-source-status.md`
- `packages/render/src/assets/glb-source-loader-status.ts`
- `packages/render/src/assets/glb-source-loader-facade.ts`
- `packages/render/src/assets/gltf-report-driven-import.ts`
- `test/assets/glb-source-loader-status.test.ts`
- `test/assets/glb-source-loader-facade.test.ts`

## Findings

- The source-loader status and no-fetch facade live in `@aperture-engine/render`,
  which keeps them renderer-independent and headless-safe.
- The facade accepts already available primary GLB bytes and optional external
  buffer bytes. It does not call `fetch`, decode images, mutate ECS state, or
  allocate WebGPU resources.
- The facade feeds bytes into the existing
  `createGltfReportDrivenImportReportFromGlb` contract and returns both the GLB
  import report and loader-style status.
- Loader status is JSON-safe: it reports status, source kind, byte lengths,
  external buffer statuses, diagnostics, and compact GLB source status without
  raw bytes.
- Tests cover pending, loaded, failed, externally blocked, invalid GLB bytes,
  missing external bytes, and provided external bytes.
- Docs clearly state that this is not browser file loading, URL fetching,
  dependency scheduling, image decoding, cache/retry/reload/unload management,
  or viewer behavior.

## Architecture Check

- ECS remains authoritative. The facade only returns reports and does not author
  entities/components.
- Rendering remains derived. The facade does not touch render extraction,
  render-world resources, queues, bind groups, or pipelines.
- WebGPU ownership remains isolated to `@aperture-engine/webgpu`.
- The path stays aligned with the glTF scene milestone by making source loading
  testable before adding real fetch/decode lifecycle behavior.

## Recommendation

Next task: route the browser GLTF scene's inline GLB fixture through the
no-fetch source-loader facade while preserving the current ECS authoring path.
This should be a narrow runtime-orchestration slice: replace the direct GLB
import wrapper call in `examples/gltf-scene.js` with the facade, keep
`source.glbFixture` JSON-safe, and run `pnpm run check:examples` plus targeted
GLB tests.
