# GLB Loader Orchestration Facade Plan - 2026-05-17

## Scope

Plan a narrow non-WebGPU facade that composes existing GLB/glTF source reports,
registry handoff reports, ECS authoring command plans, and optional replay
reports without hiding stage outputs.

This plan does not introduce binary GLB parsing, URI fetching, image decoding,
render extraction, render-world preparation, or WebGPU upload.

## Reference Anchors

- `docs/research/GLB_ECS_COMMAND_REPLAY_BOUNDARY_PLAN_2026_05_17.md`
- `packages/render/src/assets/gltf-root.ts`
- `packages/render/src/assets/gltf-asset-mapping.ts`
- `packages/render/src/assets/gltf-source-registration.ts`
- `packages/render/src/assets/gltf-mesh-source-registration.ts`
- `packages/render/src/assets/gltf-scene-traversal.ts`
- `packages/render/src/assets/gltf-primitive-material-resolution.ts`
- `packages/render/src/assets/gltf-ecs-authoring-command-plan.ts`
- `packages/render/src/assets/gltf-ecs-command-replay.ts`
- Bevy glTF loader stage separation in
  `references/bevy/crates/bevy_gltf/src/loader/mod.rs`

## Goal

The facade should answer: "Which GLB import stages were run, which reports were
used, which side effects occurred, and what can the caller inspect next?"

It should not become an opaque `loadAndSpawnEverything` path. The caller should
still be able to inspect every nested report and decide whether to register
assets, replay commands, run transform resolution, or continue to render
extraction.

## Proposed Helper

Add a later helper under `packages/render/src/assets`:

```ts
interface GltfLoaderOrchestrationReportOptions {
  readonly root?: GltfRootValidationReport;
  readonly assetMapping?: GltfAssetMappingReport;
  readonly sourceRegistration?: GltfSourceAssetRegistrationReport;
  readonly meshConstruction?: GltfMeshAssetConstructionReport;
  readonly meshRegistration?: GltfMeshSourceAssetRegistrationReport;
  readonly sceneTraversal?: GltfSceneTraversalReport;
  readonly primitiveMaterialResolution?: GltfPrimitiveMaterialResolutionReport;
  readonly ecsCommandPlan?: GltfEcsAuthoringCommandPlan;
  readonly ecsReplay?: GltfEcsCommandReplayReport;
}

function createGltfLoaderOrchestrationReport(
  options: GltfLoaderOrchestrationReportOptions,
): GltfLoaderOrchestrationReport;
```

The first implementation can be report-only: it accepts already-produced stage
reports and returns a top-level status summary. A later helper may create the
intermediate reports from glTF JSON and caller-provided bytes/image data, but it
should still return all nested reports.

## Stage Classification

Pure report stages:

- Root validation.
- Texture/sampler/material source mapping.
- Mesh primitive mapping, accessor validation, decoding, and construction.
- Scene traversal.
- Primitive material resolution.
- ECS authoring command planning.

Asset mutation stages:

- Texture/sampler/material source registration into `AssetRegistry`.
- Mesh source registration into `AssetRegistry`.

ECS mutation stages:

- ECS command replay into a caller-provided `EcsWorld`.

Deferred stages:

- Transform resolution.
- Render extraction.
- Render snapshot application.
- Render-world preparation.
- WebGPU resource upload.

The facade report should make these classes visible so callers can distinguish
pure diagnostics from actual side effects.

## Report Shape

```ts
interface GltfLoaderOrchestrationReport {
  readonly valid: boolean;
  readonly stages: readonly GltfLoaderStageSummary[];
  readonly diagnostics: readonly GltfLoaderOrchestrationDiagnostic[];
}

interface GltfLoaderStageSummary {
  readonly stage: string;
  readonly status: "provided" | "missing" | "skipped" | "failed";
  readonly sideEffect: "none" | "asset-registry" | "ecs-world";
  readonly valid?: boolean;
  readonly writtenCount?: number;
  readonly createdCount?: number;
  readonly diagnosticCount?: number;
}
```

The report should initially summarize nested reports rather than embedding every
large nested payload. JSON helpers can later include compact nested summaries and
diagnostics, while keeping raw typed arrays, ECS entities, and registry entries
out of serialized output.

## Diagnostics

Initial diagnostic codes:

- `gltfLoader.missingStage`
- `gltfLoader.failedStage`
- `gltfLoader.sideEffectWithoutPrerequisite`
- `gltfLoader.invalidStageOrder`

Diagnostics should include:

- `stage`
- `requiredStage`
- `message`

Examples:

- ECS replay was provided without an ECS command plan.
- Mesh registration was provided without mesh construction.
- Command planning was provided without scene traversal.
- A failed pure report stage appears before a provided mutation stage.

## Boundaries

The facade may:

- Summarize existing reports.
- Compose stage validity into a top-level status.
- Preserve nested diagnostics in compact JSON-safe form.
- Identify which stages had asset-registry or ECS-world side effects.

The facade must not:

- Hide or discard nested report data.
- Mutate `AssetRegistry` or `EcsWorld` unless a later explicitly named helper
  accepts those objects and documents the side effect.
- Run render extraction.
- Create render packets or snapshots.
- Prepare render-world resources.
- Touch WebGPU.
- Fetch URIs or decode external image data.

## Required Tests

The implementation slice should cover:

- Happy path with provided stage reports through ECS command replay.
- Partial path where command planning is missing but source registration exists.
- Failed stage propagation into top-level validity.
- Side-effect classification for source registration and replay stages.
- JSON projection that omits raw `MeshAsset` buffers, registry entries, ECS
  entities, render packets, and GPU handles.

## Follow-Up

After the report skeleton and JSON projection exist, audit the facade before any
helper starts generating intermediate reports from raw glTF input. The facade
should remain an orchestration and inspection surface, not a hidden scene loader
that bypasses Aperture's ECS/render boundaries.
