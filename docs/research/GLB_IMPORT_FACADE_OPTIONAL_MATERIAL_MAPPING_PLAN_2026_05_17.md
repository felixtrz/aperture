# GLB Import Facade Optional Material Mapping Plan - 2026-05-17

## Scope

Plan optional material/texture source mapping inside the report-driven import
facade.

This remains a pure report stage. It must not register assets, decode image
bytes, fetch URIs, replay ECS commands, run render extraction, or touch WebGPU.

## Reference Anchors

- `docs/research/MINIMAL_GLB_REPORT_DRIVEN_IMPORT_FACADE_PLAN_2026_05_17.md`
- `docs/research/MINIMAL_GLB_ASSET_MAPPING_ORCHESTRATION_REPORT_PLAN_2026_05_17.md`
- `docs/research/MINIMAL_GLB_TEXTURE_IMAGE_MAPPING_PLAN_2026_05_17.md`
- `packages/render/src/assets/gltf-report-driven-import.ts`
- `packages/render/src/assets/gltf-asset-mapping.ts`
- `packages/render/src/materials/gltf-texture.ts`
- `packages/render/src/materials/gltf-material.ts`

## Proposed Options

Extend `GltfReportDrivenImportOptions` later with:

```ts
interface GltfReportDrivenImportOptions {
  readonly createAssetMapping?: boolean;
  readonly resolveImageData?: GltfAssetMappingImageResolver;
}
```

`createAssetMapping` should default to `false`. When true, the facade calls
`createGltfAssetMappingReport` with the root and caller-provided
`resolveImageData`.

If `createAssetMapping` is true and `resolveImageData` is missing, the facade
should still create a mapping report using a resolver that returns `null`, so
missing image data is reported by the existing mapping diagnostics instead of
throwing.

## Stage Behavior

When enabled:

```text
root
  -> root validation report
  -> scene traversal report
  -> optional asset mapping report
  -> orchestration report
```

The mapping report should be passed to orchestration as `assetMapping`, a pure
report stage with side effect `none`.

Source registration remains caller-provided. The facade must not create an
`AssetRegistry` or call source registration helpers in this slice.

## Diagnostics

Prefer existing mapping diagnostics for:

- missing image data;
- malformed textures/samplers/materials;
- unsupported required extensions.

Facade-specific diagnostics should be limited to option conflicts, such as:

- `provided.assetMapping` and `createAssetMapping: true` both supplied.

Prefer rejecting conflicting inputs rather than silently overriding provided
reports.

## Tests

Implementation should cover:

- `createAssetMapping: true` with decoded image data produces a provided
  `assetMapping` stage.
- Missing image data produces a failed `assetMapping` stage through existing
  mapping diagnostics.
- `provided.assetMapping` plus `createAssetMapping: true` produces a facade
  diagnostic.
- The facade still does not register assets, replay ECS, extract render data, or
  touch WebGPU.

## Non-Goals

- No URI fetching.
- No image decoding.
- No asset registry mutation.
- No ECS replay.
- No mesh accessor decoding beyond caller-provided reports.
- No render extraction or WebGPU preparation.
