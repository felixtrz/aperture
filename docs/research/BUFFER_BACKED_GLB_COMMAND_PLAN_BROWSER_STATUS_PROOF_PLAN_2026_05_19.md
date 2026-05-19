# Buffer-Backed GLB Command-Plan Browser Status Proof Plan - 2026-05-19

## Scope

Plan the next browser status slice for the buffer-backed GLB fixture.

The browser example already publishes a buffer-backed GLB source fixture with a
ready mesh-construction summary. The next step should add command-plan and
replay-readiness status for that buffer-backed source path without changing
visible rendering.

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/BROWSER_RUNTIME_REPLAY_FACADE_ADOPTION_AUDIT_2026_05_19.md`
- `examples/gltf-scene.js`
- `test/e2e/gltf-scene.spec.ts`
- `packages/render/src/assets/glb-source-loader-facade.ts`
- `packages/render/src/assets/gltf-ecs-authoring-command-plan.ts`
- `packages/render/src/assets/gltf-ecs-command-replay-readiness.ts`

## Candidate A - Status-Only Command-Plan Proof

Build a command plan from the buffer-backed GLB fixture's parsed root and mesh
registration/material-resolution reports, then publish compact command-plan and
replay-readiness summaries under `source.bufferBackedGlbFixture`.

Pros:

- Proves source-loader output can carry the next source-to-scene planning layer.
- Keeps visible rendering stable.
- Lets Playwright assert JSON safety before runtime replay is connected to this
  secondary source proof.

Cons:

- Does not yet render the buffer-backed primitive.

## Candidate B - Runtime Replay Status Proof

Create a secondary headless app in the browser example, replay the buffer-backed
command plan through the runtime facade, and publish replay counts.

Pros:

- Stronger proof of source-to-runtime handoff.

Cons:

- Adds another app/world path inside the browser example.
- More likely to blur status-only source proof with visible rendering.

## Candidate C - Visible Buffer-Backed Primitive

Replay the buffer-backed command plan into the visible scene and render it.

Pros:

- Strongest product proof.

Cons:

- Too broad for the next slice because asset registration, material resolution,
  replay, queueing, and pixels would all change together.

## Selected Direction

Select Candidate A: add a status-only buffer-backed command-plan and replay
readiness proof.

The proof should reuse existing source reports and the command-plan/readiness
summary helpers. It should not create another world, call replay, mutate visible
scene state, or change pixels.

## Selected Follow-Up Queue

### task-1972 — Add buffer-backed GLB command-plan browser status proof

Category: `runtime-orchestration`
Package/write-scope: `examples/gltf-scene.js`,
`test/e2e/gltf-scene.spec.ts`.
Reference anchor:
`docs/research/BUFFER_BACKED_GLB_COMMAND_PLAN_BROWSER_STATUS_PROOF_PLAN_2026_05_19.md`,
the buffer-backed GLB fixture helper, and `docs/ARCHITECTURE.md`.

Acceptance criteria:

- Browser status includes a buffer-backed GLB command-plan summary.
- Browser status includes a buffer-backed replay-readiness summary.
- Playwright asserts summary status/counts and JSON safety.
- Visible rendering and WebGPU behavior remain unchanged.

### task-1973 — Audit buffer-backed GLB command-plan browser status proof

Category: `audit-refactor`
Package/write-scope: `docs/research`, `agent/BACKLOG.md`, targeted checks.
Reference anchor:
`task-1972`, `docs/NORTH_STAR.md`, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Confirm the proof remains status-only and does not replay into the visible
  scene.
- Confirm ECS authority and render extraction boundaries remain intact.
- Recommend the next visible GLB-derived scene slice.

### task-1974 — Plan first visible buffer-backed GLB primitive replay

Category: `docs-tooling`
Package/write-scope: `docs/research`, `agent/BACKLOG.md`.
Reference anchor:
`task-1973`, `examples/gltf-scene.js`, `test/e2e/gltf-scene.spec.ts`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Define the smallest visible buffer-backed GLB primitive replay proof.
- Decide whether to reuse an existing material or add a minimal unlit material
  mapping for the buffer-backed primitive.
- Add implementation and audit follow-up tasks with Playwright status/pixel
  expectations.

### task-1975 — Add visible buffer-backed GLB primitive replay proof

Category: `runtime-orchestration`
Package/write-scope: `examples/gltf-scene.js`,
`test/e2e/gltf-scene.spec.ts`, targeted render/runtime tests if needed.
Reference anchor:
`task-1974`, `docs/ARCHITECTURE.md`, and the established GLTF browser scene
fixture path.

Acceptance criteria:

- Replay one buffer-backed GLB-derived primitive into the visible browser scene.
- Playwright asserts source status, replay status, and a stable visible pixel or
  readback difference.
- Keep external loading, broad viewer behavior, and new material systems
  deferred.

### task-1976 — Audit visible buffer-backed GLB primitive replay proof

Category: `audit-refactor`
Package/write-scope: `docs/research`, `agent/BACKLOG.md`, targeted checks.
Reference anchor:
`task-1975`, `docs/NORTH_STAR.md`, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Confirm browser-visible GLB replay still follows ECS -> extraction -> WebGPU.
- Confirm source loading remains separate from runtime replay execution.
- Recommend the next glTF scene vertical-slice task.

## Non-Goals

- No external URL/file loading.
- No full GLB viewer behavior.
- No new visible geometry in the selected immediate task.
- No WebGPU resource ownership in source loading.
