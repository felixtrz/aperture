# GLB Import Facade Optional Mesh Mapping Plan - 2026-05-17

## Scope

Plan optional mesh primitive/accessor/mesh-construction report creation inside
the report-driven import facade.

This remains a pure source-data report path. It must not register mesh assets,
author ECS, run render extraction, or touch WebGPU.

## Reference Anchors

- `docs/research/MINIMAL_GLB_REPORT_DRIVEN_IMPORT_FACADE_PLAN_2026_05_17.md`
- `docs/research/MINIMAL_GLB_MESH_PRIMITIVE_SOURCE_MAPPING_PLAN_2026_05_17.md`
- `packages/render/src/assets/gltf-mesh-primitive.ts`
- `packages/render/src/assets/gltf-accessor-validation.ts`
- `packages/render/src/assets/gltf-accessor-decoding.ts`
- `packages/render/src/assets/gltf-mesh-asset-construction.ts`
- `packages/render/src/assets/gltf-report-driven-import.ts`

## Proposed Options

Extend `GltfReportDrivenImportOptions` later with:

```ts
interface GltfReportDrivenImportOptions {
  readonly createMeshAssets?: boolean;
  readonly resolveBufferBytes?: GltfBufferBytesResolver;
}
```

`createMeshAssets` should default to `false`.

When true, the facade should run:

```text
createGltfMeshPrimitiveMappingReport
  -> validateGltfPrimitiveAccessorReferences
  -> decodeGltfPrimitiveAccessors
  -> createMeshAssetsFromGltfDecodedAccessors
```

The construction report should be passed to orchestration as `meshConstruction`.
Mesh source registration remains explicit and caller-provided.

## Buffer Resolution

The first facade slice should require caller-provided `resolveBufferBytes`.
If missing, the facade should still create primitive/accessor reports where
possible, but decoding should fail through existing accessor decoding
diagnostics rather than throwing.

The resolver should not fetch external URIs. It should receive a buffer index
and return bytes already provided by the caller.

## Conflict Policy

If `createMeshAssets` is true and `provided.meshConstruction` is also supplied,
the facade should emit a facade diagnostic and use the newly-created report.
This mirrors the asset mapping conflict policy and keeps report authority clear.

## Non-Goals

- No mesh source registration.
- No ECS command planning or replay.
- No render extraction.
- No WebGPU buffer upload.
- No external URI fetching.
- No meshopt/Draco/KTX2 support.

## Tests

Implementation should cover:

- A valid triangle primitive creates a mesh construction report and orchestration
  `meshConstruction` stage.
- Missing buffer bytes produces failed decoding/construction diagnostics without
  throwing.
- Provided mesh construction plus `createMeshAssets: true` produces a facade
  conflict diagnostic.
- JSON output summarizes mesh typed arrays through existing construction JSON
  helpers rather than embedding raw buffers.
