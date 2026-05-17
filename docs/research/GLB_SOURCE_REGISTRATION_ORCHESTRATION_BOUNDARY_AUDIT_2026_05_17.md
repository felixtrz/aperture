# GLB Source Registration Orchestration Boundary Audit - 2026-05-17

## Scope

Audited the source-registration orchestration helper from `task-0738` and the
JSON coverage from `task-0739`.

Audited files:

- `docs/research/GLB_EXPLICIT_SOURCE_REGISTRATION_ORCHESTRATION_PLAN_2026_05_17.md`
- `packages/render/src/assets/gltf-source-registration-orchestration.ts`
- `packages/render/src/assets/gltf-source-registration.ts`
- `packages/render/src/assets/gltf-mesh-source-registration.ts`
- `test/assets/gltf-source-registration-orchestration.test.ts`
- `test/assets/gltf-source-registration-orchestration-json.test.ts`

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `packages/simulation/src/assets/registry.ts`
- `references/bevy/crates/bevy_gltf/src/loader/mod.rs`

Bevy's glTF loader keeps labeled material, texture, mesh primitive, mesh, node,
and scene asset creation distinct before scene-world spawning. Aperture adapts
that split by making pure reports create planned source assets, using this
helper only for explicit source registration, and leaving ECS replay plus render
preparation to downstream caller-selected stages.

## Findings

No boundary drift found.

`registerGltfSourceAssetsFromReports` requires a caller-owned `AssetRegistry`
and accepts only already-produced asset mapping and mesh construction reports.
It mutates the registry only by calling:

- `registerGltfSourceAssetsFromMappingReport`
- `registerGltfMeshSourceAssetsFromConstructionReport`

The helper does not create an `AssetRegistry`, overwrite assets directly, decode
accessors, construct mesh assets, create scene traversal reports, resolve
primitive materials, create ECS commands, replay ECS commands, run transform
resolution, run render extraction, create render packets or snapshots, prepare a
render world, upload WebGPU resources, or use browser APIs.

The report surface preserves nested registration reports and adds only
deterministic stage summaries plus top-level diagnostics for missing input or
failed nested registration stages. Partial orchestration remains valid when one
registration input is missing and the provided stage succeeds.

The JSON projection delegates to the existing nested JSON helpers. Focused JSON
tests confirm serialized orchestration reports preserve nested summaries while
omitting raw texture bytes, mesh vertex streams, ECS command payloads, render
packets, and GPU handles.

## Validation

- Ownership scan found only the expected `AssetRegistry` type import and calls
  into the two existing registration helpers.
- `pnpm exec vitest run test/assets/gltf-source-registration-orchestration.test.ts test/assets/gltf-source-registration-orchestration-json.test.ts`
  passed.
- `pnpm exec tsc --noEmit -p tsconfig.test.json` passed.

## Follow-Ups

No corrective refactor is needed.

The next planned slice should compose the report-driven import facade, source
registration orchestration, primitive material resolution, command planning, and
ECS replay in a tiny in-memory fixture while keeping source registration and ECS
replay explicit caller choices.
