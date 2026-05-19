# First Browser-Visible GLB Replay Proof Plan - 2026-05-19

## Scope

Plan the next browser-facing step after the controlled runtime replay facade and
headless extraction proof.

The GLTF browser scene already renders fixture-authored content through ECS,
render extraction, and WebGPU. It also already obtains an ECS command plan from
the scene import contract and replays it directly. The next browser slice should
tighten that path around the new runtime facade and status surfaces before
changing visible scene content.

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/CONTROLLED_ECS_REPLAY_EXECUTION_SURFACE_AUDIT_2026_05_19.md`
- `packages/runtime/src/index.ts`
- `examples/gltf-scene.js`
- `test/e2e/gltf-scene.spec.ts`
- `packages/render/src/assets/glb-source-loader-facade.ts`
- `references/bevy/crates/bevy_gltf/src/loader/mod.rs`

## Current Browser Path

`examples/gltf-scene.js` currently:

- creates GLB-shaped source fixture status through the no-fetch facade;
- creates a scene import contract from a fixture root and source registration
  reports;
- receives an `ecsCommandPlan`;
- directly calls `replayGltfEcsAuthoringCommands({ world: app.world, plan })`;
- renders the replayed ECS state through the WebGPU app facade.

The current source-status fixture is still a status/source proof. The visible
scene path should be made more explicit before claiming a broader GLB viewer or
loader.

## Candidate A - Status-Only Runtime Replay Adoption

Replace the direct browser call to `replayGltfEcsAuthoringCommands(...)` with
`applyGltfEcsCommandPlanToApp(...)`, and publish JSON-safe replay status in the
example.

Pros:

- Moves browser execution through the controlled runtime mutation surface.
- Does not alter pixels, materials, IBL, shadows, or source loading.
- Gives Playwright a clear status assertion that replay execution is runtime
  orchestration, not source loading.

Cons:

- It does not add new visible GLB-derived geometry.

## Candidate B - Headless-Only Browser Status Proof

Keep visible rendering unchanged, but add a secondary browser status proof that
uses an offscreen/headless app path to replay a buffer-backed GLB command plan.

Pros:

- Avoids touching the visible scene.
- Can prove source-loader output plus runtime replay in one browser status
  branch.

Cons:

- Adds a second app-like path inside the example.
- Risks confusing status-only proof with visible rendering.

## Candidate C - Replay One Buffer-Backed GLB Primitive Into The Visible Scene

Use the buffer-backed GLB fixture's mesh construction and command plan to add
one visible primitive to the scene.

Pros:

- Strongest visible proof.

Cons:

- Too much for the next slice: it mixes source-loader output, asset
  registration, command planning, runtime replay, material readiness, and pixel
  expectations.

## Selected Direction

Select Candidate A: adopt the runtime replay facade in the browser GLTF scene
without changing visible content.

This is the smallest browser-visible proof that the execution surface is now
where architecture says it should be: runtime orchestration mutates ECS, and
rendering remains derived from extraction. It also gives the next audit a clear
boundary to inspect before adding source-loader-driven visible content.

## Selected Follow-Up Queue

### task-1969 - Route GLTF browser scene replay through runtime facade

Category: `runtime-orchestration`
Package/write-scope: `examples/gltf-scene.js`,
`test/e2e/gltf-scene.spec.ts`.
Reference anchor:
`docs/research/FIRST_BROWSER_VISIBLE_GLB_REPLAY_PROOF_PLAN_2026_05_19.md`,
`packages/runtime/src/index.ts`, `examples/gltf-scene.js`, and Bevy scene
spawning patterns.

Acceptance criteria:

- Replace direct browser example calls to `replayGltfEcsAuthoringCommands` with
  `applyGltfEcsCommandPlanToApp`.
- Publish JSON-safe replay status proving runtime facade execution succeeded.
- Playwright asserts the status and existing visible pixels remain stable.
- The no-fetch source-loader facade remains report-only.

### task-1970 - Audit browser runtime replay facade adoption

Category: `audit-refactor`
Package/write-scope: `docs/research`, `agent/BACKLOG.md`, targeted checks.
Reference anchor:
`task-1969`, `docs/NORTH_STAR.md`, `docs/ARCHITECTURE.md`, and
`examples/gltf-scene.js`.

Acceptance criteria:

- Confirm browser replay execution goes through runtime orchestration.
- Confirm source-loader status remains report-only.
- Confirm rendering remains derived from ECS extraction and WebGPU owns only GPU
  resources.
- Recommend exactly one next browser GLB source-to-scene task.

### task-1971 - Plan buffer-backed GLB command-plan browser status proof

Category: `docs-tooling`
Package/write-scope: `docs/research`, `agent/BACKLOG.md`.
Reference anchor:
`task-1970`, `examples/gltf-scene.js`,
`packages/render/src/assets/glb-source-loader-facade.ts`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Compare a status-only buffer-backed command-plan proof with adding visible
  geometry.
- Select one narrow next slice with Playwright status expectations.
- Keep broad viewer behavior and external file loading deferred.

### task-1972 - Add buffer-backed GLB command-plan browser status proof

Category: `runtime-orchestration`
Package/write-scope: `examples/gltf-scene.js`,
`test/e2e/gltf-scene.spec.ts`.
Reference anchor:
`task-1971`, the buffer-backed GLB fixture helper, and
`docs/ARCHITECTURE.md`.

Acceptance criteria:

- Browser status includes a buffer-backed GLB command-plan and runtime replay
  readiness proof without changing visible rendering.
- Playwright asserts command-plan/replay-readiness status and JSON safety.
- No external URL/file loading or WebGPU ownership moves into source loading.

### task-1973 - Audit buffer-backed GLB command-plan browser status proof

Category: `audit-refactor`
Package/write-scope: `docs/research`, `agent/BACKLOG.md`, targeted checks.
Reference anchor:
`task-1972`, `docs/NORTH_STAR.md`, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Confirm the proof remains status-only unless the selected implementation
  explicitly renders geometry.
- Confirm ECS authority and render extraction boundaries remain intact.
- Recommend the next visible GLB-derived scene slice.

## Non-Goals

- No external URL/file loading.
- No drag-and-drop viewer behavior.
- No new material, IBL, or shadow behavior.
- No source-loader replay execution.
- No broad GLB scene-loader claims.
