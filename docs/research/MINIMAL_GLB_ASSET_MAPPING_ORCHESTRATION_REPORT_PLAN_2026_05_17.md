# Minimal GLB Asset Mapping Orchestration Report Plan - 2026-05-17

## Scope

Plan a renderer-independent orchestration report that collects the existing GLB
helper outputs without mutating the asset registry, authoring ECS entities,
decoding images, or touching WebGPU.

This is the bridge between isolated source-data mappers and a future GLB asset
loader. The report should answer: "What source assets would be created, what
handles would they use, and why did any mapping fail?"

Reference anchors:

- `docs/research/GLB_CONTAINER_SLICE_PLAN_2026_05_16.md`
- `docs/research/GLB_ROOT_MATERIAL_TEXTURE_HELPER_BOUNDARY_AUDIT_2026_05_17.md`
- three.js `GLTFLoader` dependency orchestration
- PlayCanvas GLB resource creation flow
- Bevy glTF asset loading and sub-asset labeling

## Proposed Helper

Add a helper under `packages/render/src/assets`:

```ts
createGltfAssetMappingReport(input): GltfAssetMappingReport
```

Inputs:

- `root`: plain glTF JSON root object.
- `materialIndices`: material indices to map, defaulting to all materials.
- `resolveImageData`: caller-owned decoded image resolver passed through to
  texture mapping.
- Optional key prefix for deterministic planned handles.

The helper may call:

- `validateGltfRootForAssetMapping`
- `createTextureAssetFromGltfTexture`
- `createMaterialAssetFromGltfMaterial`
- `createSamplerAssetFromGltfSampler` indirectly through texture mapping

The helper must not:

- parse GLB bytes,
- fetch URIs,
- decode PNG/JPEG,
- mutate `AssetRegistry`,
- spawn ECS entities,
- create `RenderSnapshot`,
- call WebGPU APIs.

## Planned Handle Keys

The report should use deterministic keys so later registry mutation can be a
small mechanical step:

```text
gltf:texture:<textureIndex>:<slot>
gltf:sampler:<textureIndex>:<slot>
gltf:material:<materialIndex>
```

If the same glTF texture is used by multiple material slots, the slot remains
part of the planned texture/sampler key so sRGB and data texture assets are not
accidentally reused across incompatible semantics.

## Report Shape

Minimal report:

```ts
interface GltfAssetMappingReport {
  valid: boolean;
  root: GltfRootValidationReportJsonValue;
  textures: GltfPlannedTextureAsset[];
  samplers: GltfPlannedSamplerAsset[];
  materials: GltfPlannedMaterialAsset[];
  diagnostics: GltfAssetMappingDiagnostic[];
}
```

Planned entries should include:

- handle key,
- source glTF index,
- slot where relevant,
- source asset value when mapping succeeded,
- nested helper report JSON value,
- diagnostics copied or summarized with source context.

Diagnostics should preserve:

- source layer: `root`, `texture`, `sampler`, or `material`,
- material index when applicable,
- texture index when applicable,
- sampler index when applicable,
- slot when applicable,
- severity,
- message.

## Texture-To-Material Resolver Flow

The orchestration report should build texture reports before material reports.
Material mapping then receives a resolver that:

- returns planned texture/sampler handles when the relevant texture report is
  valid,
- returns resolver diagnostics derived from texture reports when mapping failed,
- keeps texture failures as `dependencyKind: "texture"`,
- keeps sampler failures as `dependencyKind: "sampler"`.

This is already proven in `test/materials/gltf-material-texture-integration.test.ts`
without creating registry entries.

## Non-Goals

- No registry writes.
- No ECS authoring commands.
- No image decoding.
- No external resource fetching.
- No mesh, node, scene, camera, animation, skin, or accessor mapping.
- No WebGPU resource creation.

## Follow-Up Slices

1. Implement the orchestration report skeleton for materials and their referenced
   textures.
2. Add JSON fixture tests for planned handle keys and nested diagnostics.
3. Audit the helper before adding asset registry mutation.
4. Plan asset-registry mutation as a later explicit slice.
