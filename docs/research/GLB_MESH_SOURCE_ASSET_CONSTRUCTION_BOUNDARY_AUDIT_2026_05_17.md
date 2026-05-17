# GLB Mesh Source Asset Construction Boundary Audit

Date: 2026-05-17

## Scope

This audit covers the GLB mesh source asset construction helper and tests added
after the typed-array decoding report:

- `packages/render/src/assets/gltf-mesh-asset-construction.ts`
- `test/assets/gltf-mesh-asset-construction.test.ts`
- `test/assets/gltf-mesh-asset-construction-json.test.ts`

Reference anchors:

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/research/GLB_MESH_SOURCE_ASSET_CONSTRUCTION_HANDOFF_PLAN_2026_05_17.md`
- `docs/research/MESH_GEOMETRY_COVERAGE.md`

## Findings

- The helper consumes decoded, renderer-independent accessor arrays and returns
  plain `MeshAsset` source data.
- The helper does not register assets, mutate `AssetRegistry`, author ECS
  entities/components, emit render packets, or touch WebGPU/browser APIs.
- The first slice constructs one interleaved vertex stream, an optional index
  buffer, one submesh, one material slot, and local AABB/sphere bounds.
- Validation covers valid construction, invalid index values, mismatched
  optional attribute counts, and JSON-safe report summaries.
- The JSON projection summarizes typed-array constructor and length only. Raw
  vertex/index contents are not embedded in the serialized report.

## Boundary Scan

Searched the implementation, tests, and handoff plan for:

```text
World Entity Ecs Component addComponent spawn AssetRegistry register WebGPU GPU
device queue canvas navigator document window
```

The implementation had no matches. Test matches were limited to negative
assertions that serialized construction reports do not contain `GPU` or
`EcsWorld`. Documentation matches describe the intended non-goals and next
handoff boundary.

## Validation

- `pnpm run check:boundaries`
- `pnpm exec vitest run test/assets/gltf-mesh-asset-construction.test.ts test/assets/gltf-mesh-asset-construction-json.test.ts`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`

## Follow-Ups

- Register constructed mesh source assets in the existing source asset registry
  path as a separate task.
- Keep ECS authoring command generation out of mesh construction until mesh
  asset registration and primitive material resolution are both available.
