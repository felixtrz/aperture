# No-Fetch ECS Command-Plan Summary Slice Plan - 2026-05-19

## Scope

Plan the next report-only no-fetch source-loader output slice: a compact ECS
authoring command-plan summary derived from existing glTF reports.

This slice should make the source-to-scene path more inspectable without
mutating ECS state, replaying commands, creating a registry, preparing WebGPU
resources, or changing visible browser rendering.

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/SOURCE_REGISTRATION_SUMMARY_ADOPTION_AUDIT_2026_05_19.md`
- `packages/render/src/assets/gltf-ecs-authoring-command-plan.ts`
- `packages/render/src/assets/glb-source-loader-output-summary.ts`
- `packages/render/src/assets/glb-source-loader-facade.ts`
- `test/assets/gltf-ecs-authoring-command-plan.test.ts`
- `test/assets/glb-source-loader-output-summary.test.ts`
- `test/assets/glb-source-loader-facade.test.ts`
- `references/bevy/crates/bevy_gltf/src/loader/mod.rs`
- `references/bevy/crates/bevy_gltf/src/loader/extensions/mod.rs`
- `references/bevy/crates/bevy_gltf/src/lib.rs`

## Reference Pattern

Bevy's glTF loader separates source asset loading from scene instantiation:

- glTF scenes are loaded as labeled scene/world assets.
- Nodes become spawned entities with transforms, visibility, names, cameras, and
  mesh/material children.
- Users later spawn a scene handle through commands rather than treating the
  renderer as the authoritative scene owner.

Aperture should adapt only the staging concept. Because Aperture's near-term
GLB no-fetch facade is still a source/report boundary, the next step should
publish a JSON-safe summary of an existing command plan, not execute that plan.

## Current Inputs

The codebase already has the pieces needed for a report-only command-plan
summary:

- `createGltfSceneTraversalReport(...)` produces scene/node traversal data.
- `createGltfEcsAuthoringCommandPlan(...)` produces serializable commands and
  diagnostics for scene roots, nodes, primitive renderables, parent keys, mesh
  handles, material handles, and visibility.
- `createGlbSourceLoaderOutputSummaryJsonValue(...)` already summarizes mesh
  construction and optional source-registration reports without exposing raw
  arrays or mutable state.
- `createNoFetchGlbSourceLoaderReport(...)` accepts already provided GLB bytes
  and optional side-channel reports, then returns loader-style status plus
  output summaries.

## Proposed Summary Shape

Add an `ecsCommandPlan` section to `GlbSourceLoaderOutputSummaryJsonValue`:

```ts
interface GlbSourceLoaderEcsCommandPlanSummaryJsonValue {
  readonly status: "absent" | "ready" | "invalid";
  readonly valid: boolean | null;
  readonly sceneIndex: number | null;
  readonly rootEntityCount: number;
  readonly commandCount: number;
  readonly createEntityCount: number;
  readonly addComponentCount: number;
  readonly componentCounts: readonly {
    readonly component: GltfEcsAuthoringComponentName;
    readonly count: number;
  }[];
  readonly dependencyCount: number;
  readonly skippedCount: number;
  readonly diagnosticsCount: number;
}
```

The summary should count command-plan structure only. It should not embed the
full command list, component values, entity maps, ECS world state, source
registry internals, mesh vertex/index arrays, texture/image bytes, or GPU
resources.

## Status Rules

- `absent`: no command-plan report was provided.
- `ready`: a provided command plan is valid.
- `invalid`: a provided command plan is invalid.

`valid` should mirror the command plan when present and be `null` when absent.
`diagnosticsCount` should count top-level command-plan diagnostics plus skipped
entry diagnostics if those are separately attached to skipped entries.

## Facade Boundary

The no-fetch facade may accept an optional already-computed
`GltfEcsAuthoringCommandPlan` and include its summary in `outputSummary`.

It must not:

- call ECS replay;
- create or mutate an EliCS world;
- create or mutate an asset registry;
- mark assets ready;
- prepare render-world or WebGPU resources;
- change the visible GLTF browser scene.

Keeping the command-plan report optional matches the source-registration summary
pattern and allows tests to build the command plan from known reports without
making the source-loader facade an orchestration engine.

## Implementation Sequence

1. Add the compact summary type and helper in
   `glb-source-loader-output-summary.ts`.
2. Add tests for absent, valid, and invalid command-plan summaries.
3. Thread an optional `ecsCommandPlan` through
   `CreateNoFetchGlbSourceLoaderReportOptions`.
4. Add facade tests proving the summary is attached and JSON-safe.
5. Publish an example/docs note that ECS command-plan summaries are report-only
   and replay remains deferred.
6. Audit the boundary before implementing actual command replay status or
   browser-visible GLB-derived scene authoring.

## Selected Follow-Up Queue

### task-1954 - Add GLB source-loader ECS command-plan summary helper

Category: `render-bridge`
Package/write-scope: `packages/render/src/assets/glb-source-loader-output-summary.ts`,
`test/assets/glb-source-loader-output-summary.test.ts`.
Reference anchor:
`docs/research/NO_FETCH_ECS_COMMAND_PLAN_SUMMARY_SLICE_PLAN_2026_05_19.md`,
`packages/render/src/assets/gltf-ecs-authoring-command-plan.ts`, and Bevy glTF
scene/entity staging in `references/bevy/crates/bevy_gltf/src/loader/mod.rs`.

Acceptance criteria:

- Output summaries include an `ecsCommandPlan` section with absent, ready, and
  invalid states.
- The summary reports command counts, component counts, dependency count,
  skipped count, and diagnostics count.
- Tests prove the summary omits full commands, component payloads, ECS world
  state, raw arrays, and GPU handles.

### task-1955 - Thread ECS command-plan summaries through no-fetch facade

Category: `render-bridge`
Package/write-scope: `packages/render/src/assets/glb-source-loader-facade.ts`,
`test/assets/glb-source-loader-facade.test.ts`.
Reference anchor:
`task-1954`, the no-fetch source-registration summary pattern, and
`docs/ARCHITECTURE.md`.

Acceptance criteria:

- `createNoFetchGlbSourceLoaderReport` accepts an optional
  `GltfEcsAuthoringCommandPlan`.
- Facade output attaches the compact command-plan summary without executing
  replay or mutating ECS/assets.
- Tests cover valid and invalid provided command plans and assert JSON output
  does not expose full commands or raw source data.

### task-1956 - Document no-fetch ECS command-plan summary status

Category: `docs-tooling`
Package/write-scope: `examples/gltf-scene-source-status.md`,
`docs/index.html`, `docs/render-pipeline-comparison.html`, and
`pnpm run check:progress`.
Reference anchor:
`task-1955`, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Docs explain ECS command-plan summaries as report/readiness data only.
- Docs state actual ECS replay and visible scene authoring remain separate.
- Public tracker next-task language remains aligned.

### task-1957 - Audit ECS command-plan summary adoption

Category: `audit-refactor`
Package/write-scope: `docs/research`, `agent/BACKLOG.md`, targeted checks.
Reference anchor:
`task-1954`, `task-1955`, `docs/NORTH_STAR.md`, `docs/ARCHITECTURE.md`, and
Bevy glTF source-to-scene staging.

Acceptance criteria:

- Confirm command-plan summaries remain JSON-safe and non-authoritative.
- Confirm no registry, ECS world, command replay, render-world, or WebGPU
  mutation moved into the source loader.
- Recommend exactly one next source-to-scene task.

### task-1958 - Plan report-only ECS replay readiness status

Category: `docs-tooling`
Package/write-scope: `docs/research`, `agent/BACKLOG.md`.
Reference anchor:
`task-1957`, `packages/render/src/assets/gltf-ecs-command-replay.ts`, and
`docs/ARCHITECTURE.md`.

Acceptance criteria:

- Plan a status-only replay-readiness report that can explain why command replay
  is ready or blocked before actual execution.
- Keep ECS mutation, visible scene rendering, and WebGPU preparation deferred.
- Add concrete implementation and audit follow-up tasks.

## Non-Goals

- No ECS replay execution.
- No visible GLB-derived scene rendering changes.
- No asset registry mutation.
- No render-world or WebGPU resource preparation.
- No async URL/file loading.
- No new custom material, IBL, or shadow behavior.
