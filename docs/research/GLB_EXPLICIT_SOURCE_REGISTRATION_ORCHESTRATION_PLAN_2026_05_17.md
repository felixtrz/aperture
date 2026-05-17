# GLB Explicit Source Registration Orchestration Plan - 2026-05-17

## Scope

Plan a small helper that composes existing GLB source registration stages while
making the `AssetRegistry` side effect explicit. The helper should be the bridge
between pure report-driven import output and later ECS authoring/replay stages.

This plan does not add binary GLB parsing, URI fetching, image decoding, ECS
command replay, render extraction, render-world preparation, or WebGPU upload.

## Reference Anchors

- `docs/research/GLB_LOADER_ORCHESTRATION_FACADE_PLAN_2026_05_17.md`
- `docs/research/GLB_IMPORT_FACADE_MATERIAL_MAPPING_BOUNDARY_AUDIT_2026_05_17.md`
- `docs/research/GLB_IMPORT_FACADE_MESH_MAPPING_BOUNDARY_AUDIT_2026_05_17.md`
- `packages/render/src/assets/gltf-source-registration.ts`
- `packages/render/src/assets/gltf-mesh-source-registration.ts`
- `packages/render/src/assets/gltf-loader-orchestration.ts`
- `packages/render/src/assets/gltf-report-driven-import.ts`
- `packages/simulation/src/assets/registry.ts`
- Bevy glTF labeled sub-asset loading in
  `references/bevy/crates/bevy_gltf/src/loader/mod.rs`

## Proven Pattern

Bevy's glTF loader builds labeled sub-assets for images, samplers, materials,
mesh primitives, meshes, nodes, and scenes, then references those handles when it
builds scene-world data. Aperture should keep the same conceptual split, but
adapt it to its ECS-authoritative model:

- Pure reports produce planned source assets and stable handle keys.
- Explicit registration helpers write ready assets into a caller-provided
  `AssetRegistry`.
- ECS command planning consumes registration reports and traversal reports.
- ECS replay, extraction, render snapshots, and WebGPU preparation remain
  downstream and opt in.

## Proposed Helper

Add a later helper under `packages/render/src/assets`:

```ts
interface GltfSourceRegistrationOrchestrationOptions {
  readonly registry: AssetRegistry;
  readonly assetMapping?: GltfAssetMappingReport;
  readonly meshConstruction?: GltfMeshAssetConstructionReport;
}

function registerGltfSourceAssets(
  options: GltfSourceRegistrationOrchestrationOptions,
): GltfSourceRegistrationOrchestrationReport;
```

The name can change during implementation if a more specific local convention
emerges, but the important API property is that `registry` is required and every
other input is an already-produced report. The helper should not create mapping,
decoding, construction, traversal, material-resolution, or ECS reports.

## Execution Order

Run source registration in this order:

1. If `assetMapping` is provided, call
   `registerGltfSourceAssetsFromMappingReport`.
2. If `meshConstruction` is provided, call
   `registerGltfMeshSourceAssetsFromConstructionReport`.
3. Return both nested reports and a compact stage summary.

Material/texture/sampler and mesh registration are independent for the current
asset model, but a fixed order keeps diagnostics deterministic and prepares the
shape for future dependency summaries.

## Report Shape

```ts
type GltfSourceRegistrationStage =
  | "materialTextureSamplerRegistration"
  | "meshRegistration";

interface GltfSourceRegistrationStageSummary {
  readonly stage: GltfSourceRegistrationStage;
  readonly status: "provided" | "missing" | "failed";
  readonly writtenCount: number;
  readonly skippedCount: number;
  readonly diagnosticCount: number;
}

interface GltfSourceRegistrationOrchestrationReport {
  readonly valid: boolean;
  readonly sourceRegistration: GltfSourceAssetRegistrationReport | null;
  readonly meshRegistration: GltfMeshSourceAssetRegistrationReport | null;
  readonly stages: readonly GltfSourceRegistrationStageSummary[];
  readonly diagnostics: readonly GltfSourceRegistrationOrchestrationDiagnostic[];
}
```

The top-level report should summarize side effects without hiding nested report
data. JSON projection should include nested registration reports through their
existing JSON helpers and should not serialize registry entries or raw asset
payloads.

## Validity And Diagnostics

Initial diagnostic codes:

- `gltfSourceRegistration.missingInput`
- `gltfSourceRegistration.failedStage`

Rules:

- If both `assetMapping` and `meshConstruction` are missing, return invalid with
  one `missingInput` diagnostic.
- If one report is missing and the other is provided, return a valid partial
  orchestration unless the provided registration report fails. The missing stage
  should appear as `missing` in `stages`.
- If a nested registration report is invalid, propagate invalidity with a
  `failedStage` diagnostic and preserve the nested report diagnostics.
- Duplicate keys, invalid planned assets, missing dependencies, and invalid mesh
  handle keys remain owned by the existing registration helpers.

## Boundaries

The helper may:

- Mutate only the caller-provided `AssetRegistry`.
- Invoke only the existing material/texture/sampler and mesh registration
  helpers for mutation.
- Preserve and summarize nested registration reports.
- Produce JSON-safe summaries for diagnostics and written/skipped counts.

The helper must not:

- Create or own an `AssetRegistry`.
- Overwrite existing assets.
- Create mapping, accessor decoding, mesh construction, scene traversal, or ECS
  command reports.
- Replay ECS commands or mutate an `EcsWorld`.
- Run transform resolution, render extraction, snapshot application, render-world
  preparation, or WebGPU upload.

## Required Tests

Implementation should add focused tests for:

- Material/texture/sampler source registration with written counts and nested
  report preservation.
- Mesh source registration with written counts and nested report preservation.
- Partial input where only one source report is provided.
- Duplicate material/texture/sampler and mesh keys in the same registry, proving
  nested helper diagnostics are summarized and assets are not overwritten.
- Invalid planned assets or failed construction/mapping reports propagating to
  top-level invalidity.

JSON tests should assert:

- Stage summaries are stable.
- Nested registration reports are preserved through JSON helpers.
- Raw `AssetRegistry` entries, ECS entities, render packets, snapshots, and GPU
  handles are omitted.

## Follow-Up

After this helper exists, audit it before composing it into broader import
fixtures. The follow-up audit should confirm that the helper is the only new
asset-registry mutation surface and that ECS replay/render/WebGPU work still
requires explicit downstream calls.
