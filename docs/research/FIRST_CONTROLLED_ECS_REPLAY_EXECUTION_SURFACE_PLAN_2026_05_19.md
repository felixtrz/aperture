# First Controlled ECS Replay Execution Surface Plan - 2026-05-19

## Scope

Plan the first explicit ECS command-plan replay execution surface after the
report-only GLB source-loader, command-plan summary, and replay-readiness work.

The selected surface must make ECS mutation obvious, keep the source-loader
facade report-only, and preserve rendering as a derived snapshot.

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/ECS_REPLAY_READINESS_ADOPTION_AUDIT_2026_05_19.md`
- `packages/render/src/assets/gltf-ecs-command-replay.ts`
- `packages/render/src/assets/gltf-ecs-command-replay-readiness.ts`
- `packages/runtime/src/index.ts`
- `retired umbrella package directory/src/index.ts`
- `test/assets/gltf-ecs-command-replay.test.ts`
- `test/assets/gltf-combined-import-fixture.test.ts`
- `references/bevy/crates/bevy_gltf/src/loader/mod.rs`
- `references/bevy/crates/bevy_gltf/src/lib.rs`

## Candidate A - Test-Only Replay Fixture

Add only a focused test helper that composes GLB import, source registration,
command planning, replay, and extraction in tests.

Pros:

- Lowest API risk.
- Proves the end-to-end mutation boundary in a controlled environment.
- Keeps runtime public API unchanged.

Cons:

- Does not create a user-facing controlled execution surface.
- Leaves examples and app code without a clear place to apply ready command
  plans.

## Candidate B - Headless Runtime Replay Facade

Add a small explicit runtime helper that applies a ready glTF ECS command plan
to a `SimulationApp` or `ExtractionApp`.

Pros:

- Puts ECS mutation in `@aperture-engine/runtime`, where app/world orchestration
  already belongs.
- Keeps `@aperture-engine/render` source-loader output report-only.
- Makes the call site explicit: user/runtime code chooses to mutate ECS.
- Can be tested headlessly before any browser-visible GLB-derived rendering.

Cons:

- Introduces a small public runtime API that should be named carefully.
- Must avoid becoming a scene graph or hidden loader.

## Candidate C - Browser Example Path

Wire a browser GLTF scene fixture to replay a command plan and render from the
resulting ECS world.

Pros:

- Moves directly toward visible GLB-derived scene rendering.

Cons:

- Too much surface for the first replay execution step.
- Mixes source reports, ECS mutation, extraction, WebGPU preparation, and pixel
  behavior in one slice.
- Harder to audit if a boundary regresses.

## Selected Direction

Select Candidate B: add a headless runtime replay facade first.

Proposed shape:

```ts
interface ApplyGltfEcsCommandPlanOptions {
  readonly app: SimulationApp;
  readonly plan: GltfEcsAuthoringCommandPlan;
  readonly registerComponents?: boolean;
}

function applyGltfEcsCommandPlanToApp(
  options: ApplyGltfEcsCommandPlanOptions,
): GltfEcsCommandReplayReport;
```

The helper should live in `@aperture-engine/runtime` because it mutates the
authoritative ECS world. It may delegate to
`replayGltfEcsAuthoringCommands(...)`, but the source-loader facade must not
call it.

The first implementation should be headless-only:

- create a `SimulationApp` or `ExtractionApp`;
- build or receive an already-ready command plan;
- explicitly apply the plan to `app.world`;
- assert entities/components exist;
- for `ExtractionApp`, step/extract and assert the render snapshot is derived
  from the mutated ECS state;
- publish JSON-safe replay reports through existing replay JSON helpers.

## Selected Follow-Up Queue

### task-1964 - Add headless runtime GLTF command-plan replay facade

Category: `runtime-orchestration`
Package/write-scope: `packages/runtime/src/index.ts`, `test/runtime`.
Reference anchor:
`docs/research/FIRST_CONTROLLED_ECS_REPLAY_EXECUTION_SURFACE_PLAN_2026_05_19.md`,
`packages/render/src/assets/gltf-ecs-command-replay.ts`,
`packages/runtime/src/index.ts`, and Bevy scene-handle spawning patterns.

Acceptance criteria:

- Add an explicit runtime helper that applies a provided glTF ECS command plan
  to a `SimulationApp` world.
- The helper delegates to the existing replay implementation and returns its
  report.
- Tests prove valid plans mutate the app world and invalid plans do not create
  entities.
- The source-loader facade remains report-only.

### task-1965 - Prove replayed GLTF commands can feed extraction headlessly

Category: `runtime-orchestration`
Package/write-scope: `packages/runtime/src/index.ts`, `test/runtime`.
Reference anchor:
`task-1964`, `docs/ARCHITECTURE.md`, and existing extraction app tests.

Acceptance criteria:

- Use an `ExtractionApp` plus a ready command plan with mesh/material
  components.
- Apply the command plan, step/extract, and assert the render snapshot is
  derived from replayed ECS state.
- Keep WebGPU/browser rendering unchanged.

### task-1966 - Document controlled ECS replay execution surface

Category: `docs-tooling`
Package/write-scope: `examples/gltf-scene-source-status.md`,
`docs/index.html`, `docs/render-pipeline-comparison.html`, and
`pnpm run check:progress`.
Reference anchor:
`task-1964`, `task-1965`, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Docs distinguish source-loader summaries, replay readiness, and explicit
  runtime replay execution.
- Docs state browser-visible GLB scene rendering remains deferred until a later
  slice.
- Public tracker next-task language remains aligned.

### task-1967 - Audit controlled ECS replay execution surface

Category: `audit-refactor`
Package/write-scope: `docs/research`, `agent/BACKLOG.md`, targeted checks.
Reference anchor:
`task-1964`, `task-1965`, `docs/NORTH_STAR.md`, `docs/ARCHITECTURE.md`, and
Bevy source-to-scene staging.

Acceptance criteria:

- Confirm replay execution lives in runtime/app orchestration, not source
  loading or WebGPU.
- Confirm ECS remains authoritative and rendering remains derived from
  extraction.
- Recommend exactly one next GLB source-to-scene task.

### task-1968 - Plan first browser-visible GLB-derived scene replay proof

Category: `docs-tooling`
Package/write-scope: `docs/research`, `agent/BACKLOG.md`.
Reference anchor:
`task-1967`, `examples/gltf-scene.js`, `test/e2e/gltf-scene.spec.ts`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Compare keeping visible fixture authoring unchanged, adding a headless-only
  browser status proof, and replaying one GLB-derived primitive into the visible
  scene.
- Select the narrowest browser proof that preserves the ECS/render boundary.
- Add implementation and audit follow-up tasks.

## Non-Goals

- No source-loader replay execution.
- No WebGPU resource preparation in runtime.
- No browser-visible GLB-derived rendering in the first replay facade task.
- No external URL/file loading.
- No scene graph API.
