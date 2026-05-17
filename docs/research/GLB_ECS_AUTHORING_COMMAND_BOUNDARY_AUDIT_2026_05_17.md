# GLB ECS Authoring Command Boundary Audit - 2026-05-17

## Scope

Audited the GLB ECS authoring command planner introduced by `task-0707`
through `task-0709`.

Audited files:

- `docs/research/GLB_ECS_AUTHORING_FROM_SOURCE_REPORTS_PLAN_2026_05_17.md`
- `packages/render/src/assets/gltf-ecs-authoring-command-plan.ts`
- `test/assets/gltf-ecs-authoring-command-plan.test.ts`
- `test/assets/gltf-ecs-authoring-command-plan-json.test.ts`

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/research/GLB_ECS_AUTHORING_FROM_SOURCE_REPORTS_PLAN_2026_05_17.md`
- `packages/render/src/assets/gltf-scene-traversal.ts`
- `packages/render/src/assets/gltf-mesh-source-registration.ts`
- `packages/render/src/assets/gltf-primitive-material-resolution.ts`
- `packages/simulation/src/transform/components.ts`
- `packages/render/src/rendering/authoring.ts`
- `references/bevy/crates/bevy_gltf/src/loader/mod.rs`

## Findings

No boundary drift found.

The command planner stays in `@aperture-engine/render` and is report-driven. It
consumes traversal, mesh registration, and primitive material resolution reports
plus caller-provided available mesh handle keys. It does not import
`@aperture-engine/webgpu`, `@aperture-engine/runtime`, browser APIs, DOM
globals, `EcsWorld`, `AssetRegistry`, render snapshots, render packets, or GPU
resource types.

The helper emits serializable commands only. `createEntity` is a command string,
not an immediate ECS mutation. Parent relationships use `parentEntityKey`
instead of direct ECS `Entity` values, so replay can map keys to concrete
entities later.

Scene root and node commands preserve ECS transform ownership by authoring
`LocalTransform`, `Parent`, and initial `WorldTransform` data as command values.
Matrix-transform nodes are skipped with diagnostics rather than silently
authored as identity transforms.

Primitive renderable commands are emitted only when source reports prove the
mesh handle is registered or caller-provided as available and the material
handle is resolved. Missing mesh registrations and unresolved materials produce
diagnostics and skipped entries instead of placeholder renderables.

The JSON helper preserves commands, dependencies, skipped entries, and
diagnostics without embedding ECS entities, registry entries, mesh buffers,
material source assets, render packets, or GPU handles.

This matches the Bevy reference pattern at the boundary level: mesh/material
assets are identified before per-node primitive children are created. Aperture
keeps the scene-spawn step as serializable command planning instead of
mutating a world during GLB report composition.

## Validation

- Ownership scan found only expected command-schema terms such as
  `createEntity`, `entityKey`, and `parentEntityKey`; it found no forbidden
  imports or runtime/WebGPU/browser APIs.
- `pnpm run check:boundaries` passed.
- `pnpm exec vitest run test/assets/gltf-ecs-authoring-command-plan.test.ts test/assets/gltf-ecs-authoring-command-plan-json.test.ts`
  passed.
- `pnpm exec tsc --noEmit -p tsconfig.test.json` passed during the
  implementation and JSON test slices.

## Follow-Ups

No corrective refactor is needed.

The next implementation slice should add repeated mesh-reference coverage to
prove node-scoped primitive entity keys allow multiple nodes to share the same
mesh/material handles without sharing transform state.
