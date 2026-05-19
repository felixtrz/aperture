# GLB Source Status Helper Adoption Audit 2026-05-19

## Scope

Audited the compact GLB source-status helper and browser example adoption after
valid, malformed, missing-external, and externally resolved fixture coverage.

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/GLB_FIXTURE_LIMITATIONS.md`
- `examples/gltf-scene-source-status.md`
- `packages/render/src/assets/gltf-report-driven-import.ts`
- `examples/gltf-scene.js`
- `test/assets/glb-container.test.ts`

## Findings

- `gltfReportDrivenGlbImportReportToSourceStatusJsonValue` lives in
  `@aperture-engine/render`, the same renderer-independent package that owns
  source/import reports. This keeps browser status projection headless-safe.
- The helper returns compact JSON-safe status only: validity, byte length, chunk
  summaries, diagnostics, and import stage summaries.
- Raw GLB bytes, parsed JSON text, decoded image bytes, caller-provided external
  bytes, WebGPU handles, and ECS state are omitted by tests.
- `examples/gltf-scene.js` now uses the shared helper instead of hand-building
  `source.glbFixture`, reducing drift between the browser example and targeted
  GLB tests.
- The helper does not add file fetching, image decoding, dependency scheduling,
  ECS authoring side effects, or GPU resource ownership.
- Docs now state that malformed containers produce compact error status with no
  import stages and that external URI buffers are caller-provided fixture input,
  not async loading.

## Architecture Check

- ECS remains authoritative; source status is diagnostic metadata only.
- Rendering remains derived from extraction and render-world state; source
  status does not become renderer-owned gameplay state.
- WebGPU-only ownership remains isolated to `@aperture-engine/webgpu`.
- The browser example still does not claim full GLB/glTF loading.

## Recommendation

Next task: add a narrow source-loader planning note for the eventual async GLB
loading boundary. Keep it docs-only: define fetch/decode responsibilities,
cache/error surfaces, and how loaded bytes feed the existing GLB fixture/report
contract without introducing scene graph ownership or WebGPU state.
