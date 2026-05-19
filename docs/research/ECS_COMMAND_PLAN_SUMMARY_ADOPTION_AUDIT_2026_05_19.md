# ECS Command-Plan Summary Adoption Audit - 2026-05-19

## Scope

Audited the no-fetch GLB source-loader ECS command-plan summary work from
`task-1954` through `task-1956`.

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/NO_FETCH_ECS_COMMAND_PLAN_SUMMARY_SLICE_PLAN_2026_05_19.md`
- `packages/render/src/assets/gltf-ecs-authoring-command-plan.ts`
- `packages/render/src/assets/glb-source-loader-output-summary.ts`
- `packages/render/src/assets/glb-source-loader-facade.ts`
- `packages/render/src/assets/gltf-ecs-command-replay.ts`
- `test/assets/glb-source-loader-output-summary.test.ts`
- `test/assets/glb-source-loader-facade.test.ts`
- `references/bevy/crates/bevy_gltf/src/loader/mod.rs`

## Findings

- `GlbSourceLoaderOutputSummaryJsonValue` now includes an `ecsCommandPlan`
  section with `absent`, `ready`, and `invalid` states.
- The summary is aggregate-only: scene index, root entity count, command counts,
  component counts, dependency count, skipped count, and diagnostic count.
- Tests cover absent summaries, valid command plans, invalid command plans, and
  facade-attached summaries.
- JSON-safety tests assert the summary omits full command payloads, entity keys,
  transform values, registry internals, ECS world state, and GPU handles.
- `createNoFetchGlbSourceLoaderReport(...)` accepts an optional precomputed
  command plan and forwards it to the output-summary helper.

## Architecture Check

- The no-fetch facade still does not call `replayGltfEcsAuthoringCommands` or
  create/mutate an EliCS world.
- The source loader still does not create or mutate asset registries.
- The summary does not prepare render-world resources or WebGPU resources.
- Visible browser GLTF scene rendering remains on the existing fixture authoring
  path.
- The implementation follows the Bevy-inspired staging boundary conceptually:
  scene/entity authoring can be planned from source data, while actual scene
  instantiation remains a separate step.

## Recommendation

Next task: `task-1958`, plan a report-only ECS replay readiness status. That
plan should define how the loader/report path can explain whether command replay
is ready or blocked before any ECS mutation is introduced.
