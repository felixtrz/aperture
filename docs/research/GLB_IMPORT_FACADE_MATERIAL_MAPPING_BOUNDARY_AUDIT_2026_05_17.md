# GLB Import Facade Material Mapping Boundary Audit - 2026-05-17

## Scope

Audited optional material/texture source mapping inside the report-driven import
facade from `task-0730` and `task-0731`.

Audited files:

- `docs/research/GLB_IMPORT_FACADE_OPTIONAL_MATERIAL_MAPPING_PLAN_2026_05_17.md`
- `packages/render/src/assets/gltf-report-driven-import.ts`
- `test/assets/gltf-report-driven-import.test.ts`
- `test/assets/gltf-report-driven-import-json.test.ts`

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/research/MINIMAL_GLB_REPORT_DRIVEN_IMPORT_FACADE_PLAN_2026_05_17.md`
- `packages/render/src/assets/gltf-asset-mapping.ts`
- `packages/render/src/materials/gltf-texture.ts`
- `packages/render/src/materials/gltf-material.ts`

## Findings

No boundary drift found.

Optional asset mapping in the import facade remains a pure report stage. When
enabled, the facade calls `createGltfAssetMappingReport` with caller-provided
image data resolution and passes the resulting report into orchestration as
`assetMapping`. It does not register source assets, create or mutate an
`AssetRegistry`, mutate `EcsWorld`, replay ECS commands, run transform
resolution, run render extraction, create render packets or snapshots, prepare
render-world resources, fetch URIs, decode images, or touch WebGPU/browser APIs.

The facade rejects `provided.assetMapping` when `createAssetMapping` is true, so
callers do not have to guess which mapping report is authoritative.

The import JSON helper delegates to the existing asset mapping JSON projection,
which summarizes texture/material source data without embedding raw image byte
payloads. Focused JSON tests confirm serialized reports omit raw ECS, registry,
render packet, and GPU data.

## Validation

- Ownership scan found only expected test assertions; it found no forbidden
  imports or mutation/render/WebGPU APIs.
- `pnpm run check:boundaries` passed.
- `pnpm exec vitest run test/assets/gltf-report-driven-import.test.ts test/assets/gltf-report-driven-import-json.test.ts`
  passed.
- `pnpm exec tsc --noEmit -p tsconfig.test.json` passed during the material
  mapping composition and JSON test slices.

## Follow-Ups

No corrective refactor is needed.

The next planned expansion is optional mesh primitive/accessor/mesh-construction
report creation inside the facade, still as pure source-data reports with mesh
source registration left explicit and downstream.
