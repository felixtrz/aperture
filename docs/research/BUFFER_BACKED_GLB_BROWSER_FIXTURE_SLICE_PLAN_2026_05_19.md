# Buffer-Backed GLB Browser Fixture Slice Plan 2026-05-19

## Scope

Plan the next narrow source fixture slice after publishing no-fetch loader status
and output summaries in the browser GLTF scene.

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/BROWSER_SOURCE_OUTPUT_SUMMARY_PUBLICATION_AUDIT_2026_05_19.md`
- `packages/render/src/assets/glb-source-loader-facade.ts`
- `packages/render/src/assets/glb-source-loader-output-summary.ts`
- `test/assets/glb-container.test.ts`
- `test/assets/glb-source-loader-facade.test.ts`
- `references/bevy/crates/bevy_gltf/src/loader/mod.rs`

## Plan

Add a minimal buffer-backed GLB source fixture before changing visible browser
rendering. The fixture should prove that the no-fetch source-loader facade can
produce a `ready` mesh-construction output summary from real GLB BIN bytes.

Recommended fixture:

- One mesh.
- One primitive.
- POSITION accessor with three vertices.
- Unsigned-short index accessor with three indices.
- One BIN chunk containing both position and index bytes.
- No textures, image decode, source registration, ECS replay, or WebGPU changes.

Expected status:

- Loader status: `loaded`.
- Compact GLB source status: valid JSON and BIN chunk summaries.
- Output summary: mesh construction `ready`, mesh count `1`, submesh count `1`,
  vertex count `3`, index count `3`.
- Serialized status must omit raw bytes and typed arrays.

## Browser Use

Do not replace the visible GLTF scene rendering yet. The current scene renders
through the established ECS authoring path and should remain stable.

When this fixture reaches the browser example, expose it as source/readiness
proof only. It can live under the existing `source.glbFixture` once that fixture
is buffer-backed, or under a clearly named sibling if the visible-scene root
must stay separate.

## Selected Follow-Up

Implement `task-1944`: add buffer-backed GLB source fixture helper tests. Keep
the slice in render-package tests first, then decide whether the browser example
should consume that exact fixture or a sibling status.
