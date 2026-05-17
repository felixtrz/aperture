# GLB Combined Import Fixture Boundary Audit - 2026-05-17

## Scope

Audited the combined in-memory GLB fixture coverage from `task-0741`.

Audited files:

- `test/assets/gltf-combined-import-fixture.test.ts`
- `packages/render/src/assets/gltf-report-driven-import.ts`
- `packages/render/src/assets/gltf-source-registration-orchestration.ts`
- `packages/render/src/assets/gltf-primitive-material-resolution.ts`
- `packages/render/src/assets/gltf-ecs-authoring-command-plan.ts`
- `packages/render/src/assets/gltf-ecs-command-replay.ts`

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/research/GLB_EXPLICIT_SOURCE_REGISTRATION_ORCHESTRATION_PLAN_2026_05_17.md`
- `docs/research/GLB_SOURCE_REGISTRATION_ORCHESTRATION_BOUNDARY_AUDIT_2026_05_17.md`
- `docs/research/GLB_ECS_COMMAND_REPLAY_BOUNDARY_PLAN_2026_05_17.md`
- `references/bevy/crates/bevy_gltf/src/loader/mod.rs`

The Bevy anchor keeps glTF sub-asset loading, node/scene construction, and
scene-world spawning as distinguishable stages. Aperture's fixture follows that
shape with TypeScript reports and explicit caller-owned mutation surfaces.

## Findings

No boundary drift found.

The combined fixture composes these stages explicitly:

1. `createGltfReportDrivenImportReport` creates pure root validation, scene
   traversal, material/texture mapping, mesh primitive/accessor decoding, and
   mesh construction reports.
2. `registerGltfSourceAssetsFromReports` mutates only a test-owned
   `AssetRegistry`.
3. `createGltfPrimitiveMaterialResolutionReport` resolves primitive materials
   from the source registration report.
4. `createGltfEcsAuthoringCommandPlan` creates serializable ECS commands.
5. `replayGltfEcsAuthoringCommands` mutates only a test-owned `EcsWorld`.
6. `createGltfLoaderOrchestrationReport` summarizes already-produced stages.

The report-driven import facade does not create an `AssetRegistry`, replay ECS
commands, run render extraction, create render packets or snapshots, prepare a
render world, upload WebGPU resources, fetch external resources, or use browser
APIs. Source registration and ECS replay remain explicit caller choices in the
fixture.

The fixture's JSON assertion uses the replay JSON projection, which exposes
entity keys and creation/component summaries but omits raw ECS entity maps. It
also asserts that render packet, render snapshot, WebGPU, and GPU strings are
not present in the replay JSON.

The partial-registration fixture intentionally omits mesh construction and
verifies that the source-registration orchestration report marks
`meshRegistration` as `missing` while remaining valid for the provided
material/texture/sampler registration stage.

## Validation

- Ownership scan found explicit `AssetRegistry`, `createWorld`, source
  registration, and ECS replay usage only in the combined fixture test.
- `pnpm exec vitest run test/assets/gltf-combined-import-fixture.test.ts`
  passed.
- `pnpm exec tsc --noEmit -p tsconfig.test.json` passed.

## Follow-Ups

No corrective refactor is needed.

The next ready work should either add a small follow-up audit/fixture around
loader orchestration summaries or return to the renderer/material architecture
spine, keeping the GLB path honest about unsupported rendering features.
