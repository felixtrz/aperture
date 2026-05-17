# Minimal GLB Report-Driven Import Facade Plan - 2026-05-17

## Scope

Plan the smallest helper that can create selected pure GLB/glTF reports from a
glTF root object and caller-provided intermediate data, then wrap them in the
orchestration report.

This facade is still renderer-independent. It must not fetch external URIs,
decode images, mutate `AssetRegistry`, mutate `EcsWorld`, run transform
resolution, run render extraction, or touch WebGPU.

## Reference Anchors

- `docs/research/GLB_LOADER_ORCHESTRATION_FACADE_PLAN_2026_05_17.md`
- `docs/research/GLB_ORCHESTRATION_DIAGNOSTICS_BOUNDARY_AUDIT_2026_05_17.md`
- `packages/render/src/assets/gltf-root.ts`
- `packages/render/src/assets/gltf-scene-traversal.ts`
- `packages/render/src/assets/gltf-loader-orchestration.ts`
- Existing material, texture, mesh, registration, command-plan, and replay
  report helpers.
- Bevy glTF loader stage separation in
  `references/bevy/crates/bevy_gltf/src/loader/mod.rs`

## Proposed Helper

Add a later helper under `packages/render/src/assets`:

```ts
interface GltfReportDrivenImportOptions {
  readonly root: unknown;
  readonly sceneIndex?: number;
  readonly keyPrefix?: string;
  readonly provided?: Partial<GltfLoaderOrchestrationReportOptions>;
}

function createGltfReportDrivenImportReport(
  options: GltfReportDrivenImportOptions,
): GltfReportDrivenImportReport;
```

The first implementation should create only:

- root validation;
- scene traversal;
- orchestration report.

Everything else should be caller-provided through `provided` until the relevant
source data and side-effect policy are explicit.

## Report Shape

```ts
interface GltfReportDrivenImportReport {
  readonly valid: boolean;
  readonly root: GltfRootValidationReport;
  readonly sceneTraversal: GltfSceneTraversalReport;
  readonly orchestration: GltfLoaderOrchestrationReport;
  readonly diagnostics: readonly GltfReportDrivenImportDiagnostic[];
}
```

The first report-level diagnostics can be limited to facade-specific option
validation. Stage failures should remain inside their nested reports and the
orchestration summary.

## Provided Stage Policy

The `provided` object can include reports created elsewhere:

- material/texture asset mapping;
- source registration reports;
- mesh construction and mesh registration reports;
- primitive material resolution;
- ECS command plan;
- ECS replay.

The facade should not mutate registries or worlds based on these reports. It
only passes them into orchestration alongside the root and traversal reports it
created.

If `provided.root` or `provided.sceneTraversal` is supplied, the first helper
should reject it with a facade diagnostic or ignore it in favor of freshly
created root/traversal reports. Prefer rejection for clarity.

## Boundaries

The facade may:

- Validate the glTF root object.
- Create a scene traversal report from the same root.
- Merge caller-provided stage reports into an orchestration report.
- Return all nested reports for inspection.

The facade must not:

- Parse binary GLB chunks.
- Fetch external buffers or images.
- Decode image bytes.
- Decode mesh accessors unless caller-provided decoded reports are explicitly
  added by a later task.
- Register source assets.
- Replay commands into ECS.
- Run transform resolution or render extraction.
- Create render packets, render snapshots, render-world resources, or WebGPU
  resources.

## Minimal Tests

Implementation should cover:

- Happy path with a valid root and single-scene traversal.
- Passing a caller-provided mesh registration report into orchestration without
  mutating the registry.
- Partial failure when scene traversal cannot select a deterministic scene.
- JSON projection that omits raw mesh buffers, registry entries, ECS entities,
  render packets, and GPU handles.

## Follow-Up

Only after this report-driven facade exists should later tasks consider adding
optional source asset mapping or mesh/accessor report creation inside the facade.
Each new stage should preserve explicit nested reports and side-effect
boundaries.
