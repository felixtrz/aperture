# GLB Source Asset Registry Registration Contract Plan - 2026-05-17

## Scope

Plan the smallest handoff from `GltfAssetMappingReport` to Aperture's
`AssetRegistry`.

The previous orchestration slice answers which source texture, sampler, and
material assets would be created. This slice defines how those successful
planned entries become actual source-asset registry entries without expanding
into ECS authoring, image decoding, external fetch, render extraction, or
WebGPU preparation.

Reference anchors:

- `docs/research/MINIMAL_GLB_ASSET_MAPPING_ORCHESTRATION_REPORT_PLAN_2026_05_17.md`
- `docs/research/GLB_ORCHESTRATION_REPORT_BOUNDARY_AUDIT_2026_05_17.md`
- `docs/ARCHITECTURE.md`
- Aperture `AssetRegistry.register`, `markReady`, dependency reports, and
  typed asset collection behavior
- Bevy glTF sub-asset labels and asset loading separation
- PlayCanvas container resource loading vs entity instantiation separation

Common reference pattern: GLB loading should produce stable sub-asset identities
before any scene/entity instantiation occurs. Aperture should adapt that by
promoting planned source assets into `AssetRegistry` entries first, then leaving
ECS authoring and renderer preparation to later explicit slices.

## Proposed Helper

Add a helper under `packages/render/src/assets`:

```ts
registerGltfSourceAssetsFromMappingReport(input): GltfSourceAssetRegistrationReport
```

Inputs:

- `registry`: the target `AssetRegistry`.
- `report`: a `GltfAssetMappingReport`.

The helper may import simulation asset handles and registry types. It may import
renderer-independent material helpers such as `materialTextureBindings` to
derive material dependencies.

The helper must not:

- parse GLB bytes,
- fetch image or buffer URIs,
- decode image bytes,
- author ECS entities or components,
- create render snapshots,
- prepare render assets,
- call WebGPU APIs,
- overwrite existing registry entries.

## Registry Write Semantics

Successful planned entries become `ready` source assets immediately:

1. Create the typed handle from the planned handle id/key.
2. Call `registry.register(handle, { label, dependencies, diagnostics })`.
3. Call `registry.markReady(handle, sourceAsset, diagnostics)`.

This mirrors `TypedAssetCollection.add`: mapped source data is already available,
so it should not remain in `registered` or `loading` state.

Registration order is deterministic:

1. textures,
2. samplers,
3. materials.

Textures and samplers have no registry dependencies in this first slice.
Materials should include every non-null texture and sampler handle referenced by
their `MaterialTextureBinding`s as registry dependencies. This lets
`AssetRegistry.createManifestReport()` expose material-to-texture/sampler edges
without making the renderer inspect GLB internals later.

## Planned Handle Normalization

Current orchestration reports use deterministic planned ids:

- texture id: `gltf:texture:<textureIndex>:<slot>`
- sampler id: `gltf:sampler:<textureIndex>:<slot>`
- material handle key: `material:gltf:material:<materialIndex>`

The registration helper should preserve those planned strings in its report but
write normalized asset handles:

- `createTextureHandle(plannedTexture.handleKey)`
- `createSamplerHandle(plannedSampler.handleKey)`
- `createMaterialHandle(materialIdFromHandleKey(plannedMaterial.handleKey))`

The registration report should expose both:

- `plannedHandleKey`: the value from `GltfAssetMappingReport`,
- `registeredHandleKey`: the full `assetHandleKey(handle)` written to the
  registry or skipped.

This avoids a breaking orchestration-report rename while making actual registry
entries unambiguous.

## Duplicate-Key Behavior

`AssetRegistry.register` throws on duplicates, so the helper must preflight
`registry.has(handle)` and skip duplicates before writing.

Duplicate behavior:

- Do not overwrite.
- Do not call `register` or `markReady` for the duplicate entry.
- Emit a `gltfRegistration.duplicateAssetKey` diagnostic.
- Include the entry in `skipped`.
- Mark the registration report invalid if any duplicate diagnostic is an error.

An existing duplicate texture or sampler still counts as an available dependency
for later material registration when `registry.has(handle)` is true. This lets a
future caller reuse already-registered source assets without rewriting them.

## Partial-Failure Behavior

The helper should be best-effort, not transactional.

Root-level errors block all writes because the source document is not trusted.
The report should skip every planned entry with a
`gltfRegistration.rootInvalid` diagnostic.

When the root is valid:

- A texture entry is writable only when its nested texture report is valid and
  `texture` is non-null.
- A sampler entry is writable only when its paired texture report is valid and
  `sampler` is non-null.
- A material entry is writable only when its nested material report is valid,
  `material` is non-null, and all texture/sampler dependencies are either
  written in this helper call or already exist in the registry.
- Invalid or missing planned source data is skipped with
  `gltfRegistration.invalidPlannedAsset`.
- Material dependency gaps are skipped with
  `gltfRegistration.missingDependency`.

Already-written entries are not rolled back if a later entry is skipped. The
returned registration report is the authoritative record of what was written and
what was skipped.

## Report Shape

Minimal report:

```ts
interface GltfSourceAssetRegistrationReport {
  readonly valid: boolean;
  readonly written: readonly GltfRegisteredSourceAsset[];
  readonly skipped: readonly GltfSkippedSourceAsset[];
  readonly diagnostics: readonly GltfSourceAssetRegistrationDiagnostic[];
}
```

Each written entry should include:

- asset kind,
- planned handle key,
- registered handle key,
- source glTF material/texture/sampler index where applicable,
- slot where applicable,
- dependency handle keys for material entries,
- diagnostics copied onto the registry entry.

Each skipped entry should include:

- asset kind,
- planned handle key,
- registered handle key when derivable,
- source index and slot where applicable,
- reason code,
- diagnostics explaining the skip.

Diagnostics should be JSON-safe and preserve enough source context for CLI,
test, and browser-report surfaces:

- `code`,
- `severity`,
- `message`,
- `kind`,
- `plannedHandleKey`,
- `registeredHandleKey`,
- `materialIndex`,
- `textureIndex`,
- `samplerIndex`,
- `slot`.

## JSON Helper

Add:

```ts
gltfSourceAssetRegistrationReportToJsonValue(report);
gltfSourceAssetRegistrationReportToJson(report);
```

JSON output must omit raw texture byte arrays. It should report written/skipped
handle keys and diagnostics only, not embed source assets.

## Non-Goals

- No ECS node/entity/scene authoring.
- No mesh, node, transform, accessor, animation, skin, camera, or light mapping.
- No image decoding or URI loading.
- No render extraction or render snapshots.
- No prepared render assets.
- No WebGPU resource creation.
- No overwrite or replacement policy.

## Follow-Up Slices

1. Implement the source asset registration report helper.
2. Add JSON stability tests for registration reports.
3. Add dependency-edge tests proving material registry entries depend on
   registered or pre-existing texture/sampler assets.
4. Plan the ECS authoring command handoff only after registration behavior is
   validated.
5. Audit the registration boundary before adding ECS authoring.
