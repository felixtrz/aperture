# GLB Mesh Source Asset Registration Plan

Date: 2026-05-17

## Goal

Register constructed GLB `MeshAsset` source data into `AssetRegistry` without
authoring ECS entities, creating render packets, preparing render-world
resources, or uploading WebGPU buffers.

This is the handoff after:

```text
mesh primitive mapping
  -> accessor/buffer validation
  -> typed-array decoding
  -> MeshAsset construction
  -> mesh source asset registration
```

## Reference Anchors

- Existing registration helper:
  `packages/render/src/assets/gltf-source-registration.ts`
- Existing registration tests:
  `test/assets/gltf-source-registration.test.ts`
- Mesh construction report:
  `packages/render/src/assets/gltf-mesh-asset-construction.ts`
- Asset registry contract:
  `packages/simulation/src/assets/registry.ts`
- Architecture docs:
  `docs/NORTH_STAR.md`, `docs/ARCHITECTURE.md`, and `docs/DECISIONS.md`

The proven local pattern is the texture/sampler/material GLB source asset
registration helper: validate the planned report, preflight duplicates, register
source assets as ready, emit JSON-safe written/skipped diagnostics, and leave
all ECS/WebGPU work for later stages.

## Proposed API

Add a narrow mesh-specific helper, either in
`packages/render/src/assets/gltf-mesh-source-registration.ts` or beside the
existing source registration helper:

```ts
interface GltfMeshSourceAssetRegistrationOptions {
  readonly registry: AssetRegistry;
  readonly report: GltfMeshAssetConstructionReport;
}

function registerGltfMeshSourceAssetsFromConstructionReport(
  options: GltfMeshSourceAssetRegistrationOptions,
): GltfMeshSourceAssetRegistrationReport;
```

The report should mirror the existing registration shape:

- `valid`
- `written`
- `skipped`
- `diagnostics`

Each written/skipped entry should include:

- `kind: "mesh"`
- `plannedHandleKey`
- `registeredHandleKey`
- `meshIndex`
- `primitiveIndex`
- `diagnostics`
- `reason` for skipped entries

## Handle Policy

`GltfMeshPrimitiveMappingReport` already records both `handleKey` and
`registeredHandleKey`. The accessor validation and decoding layers currently
carry `meshHandleKey` as the registered key. Mesh construction now exposes the
normalized planned mesh id as `handleKey` and the full registered handle key as
`registeredHandleKey`.

Registration should therefore call `createMeshHandle` with `handleKey`, not
`registeredHandleKey`. Calling it with the registered key would double-prefix
the asset key:

```ts
createMeshHandle("mesh:gltf:mesh:0:primitive:0");
```

That would double-prefix the asset key as `mesh:mesh:gltf:...`.

The helper should expose the chosen policy in tests so later ECS authoring can
consume stable mesh handle keys without guessing.

## Registration Behavior

For each constructed mesh source asset:

1. If the construction report is invalid or the planned mesh is `null`, skip the
   entry with `gltfMeshRegistration.invalidPlannedAsset`.
2. Build a mesh handle using the normalized planned id.
3. If `registry.has(handle)` is true, skip with
   `gltfMeshRegistration.duplicateAssetKey` and do not overwrite the existing
   registry entry.
4. Register the handle with label and diagnostics.
5. Mark the handle ready with the constructed `MeshAsset`.
6. Append a written report entry.

Mesh registration should not create dependency edges in this first slice.
Primitive-to-material dependencies belong to the later ECS authoring/material
resolution handoff, where an entity or render packet binds both mesh and
material handles.

## Diagnostics

Use mesh-specific codes so the report remains distinguishable from
texture/material registration:

- `gltfMeshRegistration.invalidConstructionReport`
- `gltfMeshRegistration.invalidPlannedAsset`
- `gltfMeshRegistration.duplicateAssetKey`
- `gltfMeshRegistration.invalidHandleKey`

Diagnostics should include mesh/primitive indices and both planned and
registered handle keys when available.

## JSON Projection

Add JSON helpers if the report embeds any non-plain data:

```ts
gltfMeshSourceAssetRegistrationReportToJsonValue(report);
gltfMeshSourceAssetRegistrationReportToJson(report);
```

The JSON value should contain handle keys, indices, status, and diagnostics
only. It must not embed `MeshAsset.vertexStreams[*].data`, raw typed arrays,
registry entries, ECS entities, or GPU resources.

## Tests

Focused tests should cover:

- successful registration of a constructed mesh marks the registry entry ready;
- duplicate mesh keys are skipped without overwriting the existing asset;
- null/invalid planned mesh entries are skipped without registry mutation;
- JSON report output is stable and does not embed typed-array contents;
- handle normalization does not double-prefix `mesh:` keys.

## Non-Goals

- No ECS authoring commands.
- No primitive material resolution.
- No render extraction.
- No render-world or prepared asset writes.
- No WebGPU buffer upload.
- No implicit conversion from arbitrary GLB root data; input is the construction
  report only.

## Next Step

Implement the mesh registration helper after first resolving the construction
report handle naming. Keep the implementation scoped to
`packages/render/src/assets`, focused registration tests, and JSON tests.
