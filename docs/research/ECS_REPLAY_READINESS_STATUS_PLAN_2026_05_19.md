# ECS Replay Readiness Status Plan - 2026-05-19

## Scope

Plan a report-only replay-readiness status for the GLB no-fetch/source-to-scene
path.

The goal is to explain whether a provided glTF ECS command plan is ready for
future replay before any ECS world mutation happens. This should bridge the new
`ecsCommandPlan` output summary and the existing
`replayGltfEcsAuthoringCommands(...)` implementation without executing replay
inside the source loader.

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/ECS_COMMAND_PLAN_SUMMARY_ADOPTION_AUDIT_2026_05_19.md`
- `packages/render/src/assets/gltf-ecs-authoring-command-plan.ts`
- `packages/render/src/assets/gltf-ecs-command-replay.ts`
- `packages/render/src/assets/glb-source-loader-output-summary.ts`
- `packages/render/src/assets/glb-source-loader-facade.ts`
- `test/assets/gltf-ecs-command-replay.test.ts`
- `test/assets/gltf-ecs-command-replay-json.test.ts`
- `references/bevy/crates/bevy_gltf/src/loader/mod.rs`

## Existing Replay Boundary

`replayGltfEcsAuthoringCommands(...)` is intentionally side-effectful:

- it requires an `EcsWorld`;
- it may register simulation/render-authoring components;
- it creates ECS entities;
- it applies Name, Parent, LocalTransform, WorldTransform, Visibility, Mesh, and
  Material components;
- it reports replay diagnostics and exposes an `entitiesByKey` map in the live
  report, with a JSON helper that removes raw ECS objects.

That implementation should remain separate from the no-fetch source-loader
facade.

## Proposed Readiness Shape

Add a replay-readiness summary that can be derived from a command plan alone:

```ts
interface GlbSourceLoaderEcsReplayReadinessSummaryJsonValue {
  readonly status: "absent" | "ready" | "blocked";
  readonly ready: boolean | null;
  readonly reason: string | null;
  readonly requiredWorld: true;
  readonly wouldRegisterComponents: boolean;
  readonly expectedCreateEntityCount: number;
  readonly expectedAddComponentCount: number;
  readonly requiredComponents: readonly GltfEcsAuthoringComponentName[];
  readonly blockerCount: number;
  readonly blockers: readonly {
    readonly code: string;
    readonly message: string;
    readonly count: number;
  }[];
}
```

Status rules:

- `absent`: no command plan was provided.
- `blocked`: command plan is invalid or contains commands/components that cannot
  be replayed by the current replay implementation.
- `ready`: command plan is valid and all component names are supported by the
  current replay implementation.

The summary should not create a `World`, register components, allocate entities,
call `replayGltfEcsAuthoringCommands`, expose `entitiesByKey`, or include full
command payloads.

## Initial Blockers

The first readiness helper can check:

- invalid command plan;
- unsupported component names;
- `addComponent` commands whose entity key has no matching `createEntity`
  command;
- duplicate `createEntity` keys;
- `Parent` values that reference an uncreated parent key.

It should not attempt to validate all component payload values at first. Payload
shape validation already exists in actual replay and can be planned as a later
readiness extension if needed.

## Implementation Sequence

1. Add a renderer-independent replay-readiness helper near
   `gltf-ecs-command-replay.ts` or as a focused sibling module.
2. Add JSON-safe tests for absent, ready, invalid-plan, missing-entity,
   duplicate-entity, missing-parent, and unsupported-component cases.
3. Add a compact `ecsReplayReadiness` section to no-fetch output summaries.
4. Thread an optional readiness report or command plan into the no-fetch facade
   without running replay.
5. Document the status as report-only and audit the boundary before any actual
   replay execution is connected to source-loader output.

## Selected Follow-Up Queue

### task-1959 - Add ECS replay readiness summary helper

Category: `render-bridge`
Package/write-scope: `packages/render/src/assets`, targeted tests under
`test/assets`.
Reference anchor:
`docs/research/ECS_REPLAY_READINESS_STATUS_PLAN_2026_05_19.md`,
`packages/render/src/assets/gltf-ecs-command-replay.ts`, and Bevy glTF scene
staging in `references/bevy/crates/bevy_gltf/src/loader/mod.rs`.

Acceptance criteria:

- Add a JSON-safe helper that derives replay readiness from a command plan
  without an ECS world.
- Cover absent, ready, invalid-plan, missing-entity, duplicate-entity,
  missing-parent, and unsupported-component cases.
- Tests assert the readiness summary omits full command payloads and raw ECS
  objects.

### task-1960 - Attach ECS replay readiness to no-fetch output summaries

Category: `render-bridge`
Package/write-scope: `packages/render/src/assets/glb-source-loader-output-summary.ts`,
`packages/render/src/assets/glb-source-loader-facade.ts`, targeted tests.
Reference anchor:
`task-1959`, `docs/ARCHITECTURE.md`, and the existing source-registration and
command-plan summary patterns.

Acceptance criteria:

- No-fetch output summaries include an `ecsReplayReadiness` section.
- Facade output can publish readiness without calling
  `replayGltfEcsAuthoringCommands`.
- Tests prove no ECS world, registry, render-world, or WebGPU resource state is
  exposed.

### task-1961 - Document ECS replay readiness status

Category: `docs-tooling`
Package/write-scope: `examples/gltf-scene-source-status.md`,
`docs/index.html`, `docs/render-pipeline-comparison.html`, and
`pnpm run check:progress`.
Reference anchor:
`task-1960`, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Docs explain replay readiness as report-only preflight data.
- Docs state actual ECS replay and visible GLB-derived rendering remain
  separate.
- Public tracker next-task language remains aligned.

### task-1962 - Audit ECS replay readiness adoption

Category: `audit-refactor`
Package/write-scope: `docs/research`, `agent/BACKLOG.md`, targeted checks.
Reference anchor:
`task-1959`, `task-1960`, `docs/NORTH_STAR.md`, `docs/ARCHITECTURE.md`, and
Bevy source-to-scene staging.

Acceptance criteria:

- Confirm replay readiness does not mutate ECS, assets, render-world, or WebGPU
  state.
- Confirm JSON outputs omit raw ECS world/entity maps and full command payloads.
- Recommend exactly one next source-to-scene task.

### task-1963 - Plan first controlled ECS replay execution surface

Category: `docs-tooling`
Package/write-scope: `docs/research`, `agent/BACKLOG.md`.
Reference anchor:
`task-1962`, `packages/render/src/assets/gltf-ecs-command-replay.ts`,
`@aperture-engine/runtime` app facades, and `docs/ARCHITECTURE.md`.

Acceptance criteria:

- Compare a test-only replay fixture, a headless runtime facade option, and a
  browser example path.
- Select one narrow execution surface that preserves ECS authority and keeps the
  renderer derived from snapshots.
- Add implementation and audit follow-up tasks.

## Non-Goals

- No command replay inside the source-loader facade.
- No visible browser scene rendering from GLB source data.
- No asset registry mutation.
- No render-world or WebGPU resource preparation.
- No external URL/file loading.
