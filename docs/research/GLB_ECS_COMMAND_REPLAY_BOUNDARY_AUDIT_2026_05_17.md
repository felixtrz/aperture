# GLB ECS Command Replay Boundary Audit - 2026-05-17

## Scope

Audited the GLB ECS command replay helper introduced by `task-0713` and
`task-0714`.

Audited files:

- `docs/research/GLB_ECS_COMMAND_REPLAY_BOUNDARY_PLAN_2026_05_17.md`
- `packages/render/src/assets/gltf-ecs-command-replay.ts`
- `test/assets/gltf-ecs-command-replay.test.ts`
- `test/assets/gltf-ecs-command-replay-json.test.ts`

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/research/GLB_ECS_AUTHORING_FROM_SOURCE_REPORTS_PLAN_2026_05_17.md`
- `docs/research/GLB_ECS_COMMAND_REPLAY_BOUNDARY_PLAN_2026_05_17.md`
- `packages/simulation/src/ecs/index.ts`
- `packages/simulation/src/transform/components.ts`
- `packages/render/src/rendering/authoring.ts`
- `references/bevy/crates/bevy_gltf/src/loader/mod.rs`

## Findings

No boundary drift found.

The replay helper is the first intentional ECS mutation stage in the GLB path.
It mutates only the caller-provided `EcsWorld`, optionally registers known
simulation/metadata/render authoring components, creates entities from
`createEntity` commands, and applies known component commands in a second pass.

The helper remains downstream of serializable command planning. It does not
parse GLB or glTF JSON, compose source reports, register assets in
`AssetRegistry`, run transform resolution, run render extraction, create render
packets, create render snapshots, prepare render-world resources, touch WebGPU,
or use browser APIs.

Parent replay resolves `parentEntityKey` through the entity map created during
the first pass. Mesh and material replay write only `meshId` and `materialId`
into ECS authoring components; full handle keys remain command/report
diagnostic data only.

The replay report includes a raw `entitiesByKey` map for runtime callers that
need concrete ECS entities after mutation. Its JSON helper omits that map and
summarizes created entities by key, label, index, and generation, keeping
serialized output free of raw ECS objects.

This matches the Bevy-inspired stage separation: scene/entity mutation happens
after asset labels and node/primitive command data are known, not during
source-report composition.

## Validation

- Ownership scan found only expected replay diagnostic strings and test fixture
  assertions; it found no forbidden imports or runtime/WebGPU/browser APIs.
- `pnpm run check:boundaries` passed.
- `pnpm exec vitest run test/assets/gltf-ecs-command-replay.test.ts test/assets/gltf-ecs-command-replay-json.test.ts`
  passed.
- `pnpm exec tsc --noEmit -p tsconfig.test.json` passed during the replay
  implementation and JSON test slices.

## Follow-Ups

No corrective refactor is needed.

The next focused slice should add duplicate-key and missing-key replay coverage
to lock failure behavior before a higher-level GLB loader facade is introduced.
