# GLB ECS Command Replay Boundary Plan - 2026-05-17

## Scope

Plan the smallest helper that replays a
`GltfEcsAuthoringCommandPlan` into a caller-provided `EcsWorld`.

This is the first intentionally mutating stage after GLB report composition.
It must remain downstream of source asset registration and serializable command
planning.

## Reference Anchors

- `docs/research/GLB_ECS_AUTHORING_FROM_SOURCE_REPORTS_PLAN_2026_05_17.md`
- `packages/render/src/assets/gltf-ecs-authoring-command-plan.ts`
- `packages/simulation/src/ecs/index.ts`
- `packages/simulation/src/transform/components.ts`
- `packages/render/src/rendering/authoring.ts`
- Bevy glTF scene spawning in
  `references/bevy/crates/bevy_gltf/src/loader/mod.rs`

The Bevy reference mutates a scene world after glTF sub-assets and node
relationships are known. Aperture should mirror the stage separation: replay
commands into ECS only after all report-driven planning has produced a stable
command list.

## Proposed Helper

Add a later helper under `packages/render/src/assets`:

```ts
interface GltfEcsCommandReplayOptions {
  readonly world: EcsWorld;
  readonly plan: GltfEcsAuthoringCommandPlan;
  readonly registerComponents?: boolean;
}

function replayGltfEcsAuthoringCommands(
  options: GltfEcsCommandReplayOptions,
): GltfEcsCommandReplayReport;
```

`registerComponents` should default to `true` and register the known transform,
metadata, and render authoring components required by the command schema. A
caller that already owns registration order can pass `false`.

## Replay Order

Replay should be two-phase:

1. Create all entities from `createEntity` commands and build a
   `Map<entityKey, Entity>`.
2. Apply all `addComponent` commands after entity allocation, resolving
   `Parent.parentEntityKey` through the map.

This avoids parent-order coupling and makes missing parent diagnostics
deterministic.

## Component Mapping

Known command components should map as follows:

- `Name`: add `Name` with `{ value }`.
- `LocalTransform`: add `LocalTransform` with `translation`, `rotation`, and
  `scale`.
- `Parent`: add `Parent` with `{ entity: resolvedParentEntity | null }`.
- `WorldTransform`: add `WorldTransform` with `col0`, `col1`, `col2`, `col3`.
- `Visibility`: add `Visibility` with `{ visible }`.
- `Mesh`: add `Mesh` with `{ meshId }`.
- `Material`: add `Material` with `{ materialId }`.

The replay helper may preserve full handle keys in diagnostics, but it should
write only component schema fields into ECS.

## Report Shape

```ts
interface GltfEcsCommandReplayReport {
  readonly valid: boolean;
  readonly created: readonly GltfCreatedEcsEntity[];
  readonly appliedComponents: readonly GltfAppliedEcsComponent[];
  readonly skipped: readonly GltfSkippedEcsCommand[];
  readonly diagnostics: readonly GltfEcsCommandReplayDiagnostic[];
}

interface GltfCreatedEcsEntity {
  readonly entityKey: string;
  readonly label: string;
  readonly entityIndex: number;
  readonly entityGeneration: number;
}
```

Reports may include entity index/generation for inspection, but JSON helpers
should not embed raw `Entity` objects.

## Diagnostics

Initial diagnostic codes:

- `gltfEcsReplay.invalidPlan`
- `gltfEcsReplay.duplicateEntityKey`
- `gltfEcsReplay.missingEntityKey`
- `gltfEcsReplay.missingParentEntityKey`
- `gltfEcsReplay.unknownComponent`
- `gltfEcsReplay.invalidComponentValue`
- `gltfEcsReplay.componentApplyFailed`

Diagnostics should include where possible:

- `entityKey`
- `parentEntityKey`
- `component`
- `commandIndex`
- `sourceReason`

Failed `addComponent` commands should not attach partial invalid data. Duplicate
`createEntity` commands should leave the first entity mapping intact and skip
the duplicate command.

## Boundaries

The replay helper may:

- Mutate only the caller-provided `EcsWorld`.
- Register known component definitions when requested.
- Allocate ECS entities for planned keys.
- Attach known simulation/render authoring components.

The replay helper must not:

- Parse GLB or glTF JSON.
- Create or modify source asset mapping reports.
- Register assets in `AssetRegistry`.
- Resolve or validate asset readiness beyond command values already planned.
- Run transform resolution.
- Run render extraction.
- Create render snapshots, render packets, render-world resources, or WebGPU
  resources.
- Fetch external data or use browser APIs.

## Required Tests

The implementation slice should cover:

- Scene, node, and primitive entity creation.
- Parent replay with resolved concrete ECS entities.
- Mesh and material components writing handle ids only.
- Visibility, name, local transform, and world transform component replay.
- Duplicate entity-key diagnostics.
- Missing entity-key diagnostics for `addComponent`.
- Missing parent-key diagnostics.
- JSON report projection that summarizes entities by index/generation and omits
  raw ECS objects.

## Follow-Up

After replay exists, run an audit before connecting it to any higher-level GLB
loader facade. The loader facade should orchestrate stages, not collapse
mapping, registration, command planning, ECS replay, extraction, and WebGPU
preparation into one opaque mutation path.
