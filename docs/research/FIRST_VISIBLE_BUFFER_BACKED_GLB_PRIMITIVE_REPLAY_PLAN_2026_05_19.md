# First Visible Buffer-Backed GLB Primitive Replay Plan - 2026-05-19

## Scope

Plan the first visible browser proof that replays one buffer-backed GLB-derived
primitive into the rendered scene.

The previous slice proved buffer-backed source status, mesh construction,
command-plan summary, and replay-readiness summary without changing visible
rendering. The next implementation should keep the first visible replay proof
small and reversible.

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/BUFFER_BACKED_GLB_COMMAND_PLAN_BROWSER_STATUS_PROOF_AUDIT_2026_05_19.md`
- `examples/gltf-scene.js`
- `test/e2e/gltf-scene.spec.ts`
- `packages/runtime/src/index.ts`
- `packages/render/src/assets/gltf-mesh-asset-construction.ts`
- `packages/render/src/assets/gltf-ecs-authoring-command-plan.ts`

## Candidate A - Reuse Existing Visible Scene Material

Register the buffer-backed mesh asset, create a command plan that references an
existing ready material handle, replay it through the runtime facade, and place
the primitive in a small visible location.

Pros:

- Avoids adding a new material mapping surface.
- Exercises source mesh construction, command planning, runtime replay,
  extraction, queueing, and WebGPU drawing.
- Keeps the visible proof focused on the buffer-backed mesh source path.

Cons:

- The material is not yet authored from the buffer-backed GLB source.

## Candidate B - Add Minimal Unlit Material Mapping

Add a minimal material report for the buffer-backed source and replay it with a
new unlit material.

Pros:

- Closer to a real source-to-scene path.

Cons:

- Expands the first visible slice into material mapping and asset registration.

## Candidate C - Replace An Existing Primitive

Replace one current visible primitive with the buffer-backed primitive.

Pros:

- Keeps draw count stable.

Cons:

- Makes pixel expectations harder to compare and risks disturbing existing
  StandardMaterial/IBL/shadow coverage.

## Selected Direction

Select Candidate A: add one small visible buffer-backed primitive using an
existing ready material handle.

Implementation should:

- register the constructed buffer-backed mesh asset in the app asset registry;
- build or adapt a command plan for one primitive entity with the ready mesh and
  existing material handle;
- replay through `applyGltfEcsCommandPlanToApp(...)`;
- place the primitive where it does not obscure existing IBL/shadow proof
  samples;
- publish source/replay status identifying the proof as visible;
- add Playwright status and a stable pixel/readback assertion for the added
  primitive.

## Selected Follow-Up Queue

### task-1975 — Add visible buffer-backed GLB primitive replay proof

Category: `runtime-orchestration`
Package/write-scope: `examples/gltf-scene.js`,
`test/e2e/gltf-scene.spec.ts`, targeted render/runtime tests if needed.
Reference anchor:
`docs/research/FIRST_VISIBLE_BUFFER_BACKED_GLB_PRIMITIVE_REPLAY_PLAN_2026_05_19.md`,
`docs/ARCHITECTURE.md`, and the established GLTF browser scene fixture path.

Acceptance criteria:

- Replay one buffer-backed GLB-derived primitive into the visible browser scene.
- Use an existing ready material handle for the first proof.
- Playwright asserts source status, replay status, draw count/status, and a
  stable visible pixel or readback difference.
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

### task-1977 — Plan buffer-backed GLB material mapping for visible replay

Category: `docs-tooling`
Package/write-scope: `docs/research`, `agent/BACKLOG.md`.
Reference anchor:
`task-1976`, `packages/render/src/assets/gltf-asset-mapping.ts`,
`packages/render/src/assets/gltf-source-registration.ts`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Compare minimal unlit material mapping with StandardMaterial mapping for the
  buffer-backed visible primitive.
- Select one narrow material/source registration follow-up.
- Add implementation and audit follow-up tasks.

### task-1978 — Add visible buffer-backed GLB primitive material mapping

Category: `render-bridge`
Package/write-scope: `packages/render/src/assets`, `examples/gltf-scene.js`,
`test/e2e/gltf-scene.spec.ts`, targeted tests.
Reference anchor:
`task-1977`, `docs/ARCHITECTURE.md`, and current glTF material mapping helpers.

Acceptance criteria:

- The visible buffer-backed primitive uses a material source mapped from its GLB
  root rather than borrowing an existing material handle.
- Browser status reports the material mapping/registration path.
- Playwright keeps the visible proof stable.

### task-1979 — Audit buffer-backed GLB material mapping replay

Category: `audit-refactor`
Package/write-scope: `docs/research`, `agent/BACKLOG.md`, targeted checks.
Reference anchor:
`task-1978`, `docs/NORTH_STAR.md`, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Confirm material source mapping remains renderer-independent.
- Confirm runtime replay remains separate from source loading.
- Recommend the next glTF scene vertical-slice task.

## Non-Goals

- No external URL/file loading.
- No broad viewer UI.
- No new material family.
- No source-loader replay execution.
- No IBL/shadow behavior changes.
