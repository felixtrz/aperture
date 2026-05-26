# GLB Fixture Path Boundary Audit 2026-05-19

## Scope

Audit the minimal GLB fixture path added after `task-1899` against the
ECS-authoritative, renderer-independent asset/import boundary.

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/research/ASSET_LOADER_SCENE_IMPORT_COVERAGE.md`
- `references/bevy/crates/bevy_gltf/src/loader/mod.rs`
- `packages/render/src/assets/glb-container.ts`
- `packages/render/src/assets/gltf-report-driven-import.ts`
- `test/assets/glb-container.test.ts`

## Findings

- The new `createGltfReportDrivenImportReportFromGlb` helper stays in
  `@aperture-engine/render`, which is the correct package for
  renderer-independent source asset and import reports.
- The helper only parses source bytes, provides the parsed JSON root to the
  existing glTF report-driven import path, and supplies GLB BIN chunk bytes as
  buffer `0` input. It does not introduce a scene graph, ECS side effects, or
  WebGPU ownership.
- The design mirrors the useful part of Bevy's glTF loader pattern: source
  parsing and buffer resolution happen before assets/components are authored,
  while later ECS/render stages remain separate.
- Invalid container input stops before import stages and preserves structured
  GLB diagnostics from `parseGlbContainer`.
- Package boundary validation passes, and the retired umbrella package receives the
  helper only through the existing headless-safe render re-export.

## Deferred Work

- External GLB/glTF buffer URI resolution is still caller-provided and should
  remain a separate loader/source task.
- The helper currently exposes the existing `GlbContainerParseResult`, which
  includes the raw BIN chunk. That is acceptable for source parsing, but a
  JSON-safe facade should be added before surfacing this directly in browser
  status reports.
- The browser GLTF scene still uses an inline JSON fixture with shape-based mesh
  construction. A follow-up can route that fixture through a JSON-safe GLB
  fixture status without changing renderer ownership.

## Recommendation

Next task: add a JSON-safe GLB fixture status to the browser GLTF scene example
so the public app path can prove the source contract begins at a GLB container
without exposing raw bytes.
