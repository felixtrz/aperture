# GLB Combined Fixture Diagnostics Boundary Audit - 2026-05-17

## Scope

Audited the combined GLB fixture success, JSON, and unresolved-material
diagnostic paths from `task-0743` and `task-0744`.

Audited files:

- `test/assets/gltf-combined-import-fixture.test.ts`
- `test/assets/gltf-combined-import-fixture-json.test.ts`
- `test/assets/gltf-combined-import-unresolved-material.test.ts`
- `packages/render/src/assets/gltf-report-driven-import.ts`
- `packages/render/src/assets/gltf-source-registration-orchestration.ts`
- `packages/render/src/assets/gltf-primitive-material-resolution.ts`
- `packages/render/src/assets/gltf-ecs-authoring-command-plan.ts`
- `packages/render/src/assets/gltf-ecs-command-replay.ts`

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/research/GLB_SOURCE_REGISTRATION_ORCHESTRATION_BOUNDARY_AUDIT_2026_05_17.md`
- `docs/research/GLB_COMBINED_IMPORT_FIXTURE_BOUNDARY_AUDIT_2026_05_17.md`
- `docs/research/GLB_ECS_COMMAND_REPLAY_BOUNDARY_PLAN_2026_05_17.md`
- `references/bevy/crates/bevy_gltf/src/loader/mod.rs`

## Findings

No boundary drift found.

The combined fixture success path keeps each stage explicit:

- Pure report creation stays in `createGltfReportDrivenImportReport`.
- Source registration mutates only a caller-provided `AssetRegistry` through
  `registerGltfSourceAssetsFromReports`.
- Primitive material resolution reads source registration reports and produces
  diagnostics without mutating ECS or renderer state.
- Command planning produces serializable commands.
- ECS replay mutates only a caller-provided `EcsWorld` and is called explicitly
  by the test.
- Loader orchestration summarizes already-produced reports.

The JSON fixture serializes import, source registration orchestration, primitive
material resolution, command plan, replay, and loader orchestration reports. It
preserves stage summaries and dependency diagnostics while omitting raw texture
bytes, raw mesh typed arrays, raw ECS entity maps, render packets, render
snapshots, and GPU/WebGPU handles.

The unresolved-material fixture intentionally references glTF material index `1`
while only material `0` is mapped and registered. The failure remains localized:
primitive material resolution emits
`gltfPrimitiveMaterial.unregisteredMaterial`, command planning skips only the
primitive renderable with `gltfEcsAuthoring.unresolvedPrimitiveMaterial`, and
explicit replay of the invalid plan returns `gltfEcsReplay.invalidPlan` without
creating entities. This proves the fixture diagnostics explain the blocked
stage instead of silently authoring a partial renderable.

No path in these fixtures runs transform resolution, render extraction, snapshot
application, render-world preparation, WebGPU upload, browser APIs, or a hidden
scene graph.

## Validation

- Ownership scan found explicit `AssetRegistry`, `createWorld`, source
  registration, and ECS replay usage only in tests and their intended helper
  boundaries.
- `pnpm exec vitest run test/assets/gltf-combined-import-fixture.test.ts test/assets/gltf-combined-import-fixture-json.test.ts test/assets/gltf-combined-import-unresolved-material.test.ts`
  passed.
- `pnpm exec tsc --noEmit -p tsconfig.test.json` passed.

## Follow-Ups

No corrective refactor is needed.

The GLB report-driven path now has enough fixture coverage to pause GLB
expansion and return to the renderer/material architecture spine unless a
near-term integration issue appears.
