# Controlled ECS Replay Execution Surface Audit - 2026-05-19

## Scope

Audited the headless runtime GLTF command-plan replay facade and extraction
proof from `task-1964` through `task-1966`.

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/FIRST_CONTROLLED_ECS_REPLAY_EXECUTION_SURFACE_PLAN_2026_05_19.md`
- `packages/runtime/src/index.ts`
- `packages/render/src/assets/gltf-ecs-command-replay.ts`
- `packages/render/src/assets/glb-source-loader-facade.ts`
- `test/runtime/runtime.test.ts`
- `references/bevy/crates/bevy_gltf/src/loader/mod.rs`
- `references/bevy/crates/bevy_gltf/src/lib.rs`

## Findings

- `applyGltfEcsCommandPlanToApp(...)` lives in `@aperture-engine/runtime`, the
  package that already owns headless app/world orchestration.
- The helper requires an explicit `SimulationApp` and a provided command plan,
  making ECS mutation opt-in at the runtime call site.
- It delegates to `replayGltfEcsAuthoringCommands(...)` and returns the replay
  report; it does not hide replay behind source-loader status.
- Runtime tests prove valid command plans mutate ECS and invalid plans do not
  create entities.
- Runtime extraction tests prove replayed mesh/material ECS state can produce
  render snapshot mesh draws through the normal extraction boundary.

## Architecture Check

- The no-fetch GLB source-loader facade remains report-only and does not replay
  commands.
- Runtime replay mutates ECS, which is the intended authoritative state owner.
- Rendering remains a derived view: the extraction test reads the replayed ECS
  world and produces a `RenderSnapshot`.
- No WebGPU code or browser rendering path changed.
- No scene graph API was introduced.

## Recommendation

Next task: `task-1968`, plan the first browser-visible GLB-derived scene replay
proof. Keep it narrow: compare a status-only browser proof against replaying one
small GLB-derived primitive into the visible scene, and require Playwright
status/pixel checks only when the chosen slice is explicit enough.
