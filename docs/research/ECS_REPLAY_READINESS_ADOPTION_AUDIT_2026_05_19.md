# ECS Replay Readiness Adoption Audit - 2026-05-19

## Scope

Audited the ECS replay readiness helper and no-fetch output-summary attachment
from `task-1959` through `task-1961`.

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/ECS_REPLAY_READINESS_STATUS_PLAN_2026_05_19.md`
- `packages/render/src/assets/gltf-ecs-command-replay.ts`
- `packages/render/src/assets/gltf-ecs-command-replay-readiness.ts`
- `packages/render/src/assets/glb-source-loader-output-summary.ts`
- `packages/render/src/assets/glb-source-loader-facade.ts`
- `test/assets/gltf-ecs-command-replay-readiness.test.ts`
- `test/assets/glb-source-loader-output-summary.test.ts`
- `test/assets/glb-source-loader-facade.test.ts`
- `references/bevy/crates/bevy_gltf/src/loader/mod.rs`

## Findings

- `createGltfEcsReplayReadinessSummaryJsonValue(...)` derives readiness from a
  command plan or `null`; it does not accept an `EcsWorld`.
- The readiness helper checks invalid plans, duplicate create keys, missing
  add-component targets, missing parent keys, and unsupported component names.
- No-fetch output summaries now include `ecsReplayReadiness`, derived from the
  optional provided command plan.
- Facade tests prove valid and invalid command plans can publish readiness
  summaries without exposing full command payloads, ECS state, registry state,
  or GPU handles.
- Existing actual replay remains isolated in
  `replayGltfEcsAuthoringCommands(...)`.

## Architecture Check

- The no-fetch source-loader facade still does not call
  `replayGltfEcsAuthoringCommands`.
- The readiness path does not create or mutate an EliCS world.
- The readiness path does not create, mutate, or mark ready any source asset
  registry entries.
- The readiness path does not prepare render-world or WebGPU resources.
- Browser-visible GLTF scene rendering remains unchanged and still uses the
  established fixture authoring path.

## Recommendation

Next task: `task-1963`, plan the first controlled ECS replay execution surface.
Prefer a narrow execution surface that is outside the source-loader facade, such
as a headless runtime/test fixture that consumes a ready command plan and makes
the mutation boundary explicit.
