# Report-Driven Scene Source Output Adoption Plan 2026-05-19

## Scope

Plan how the no-fetch GLB source-loader facade should expose report-driven scene
source output over time, without turning loader output into ECS state or
renderer-owned resources.

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/BROWSER_SOURCE_LOADER_FACADE_ADOPTION_AUDIT_2026_05_19.md`
- `packages/render/src/assets/glb-source-loader-facade.ts`
- `packages/render/src/assets/gltf-report-driven-import.ts`
- `packages/render/src/assets/gltf-mesh-asset-construction.ts`
- `packages/render/src/assets/gltf-asset-mapping.ts`
- `references/bevy/crates/bevy_gltf/src/loader/mod.rs`

## Output Staging Model

The no-fetch source-loader facade should stay a source/import boundary. It may
expose JSON-safe summaries of report-driven import results, but those summaries
are diagnostics and readiness data, not the source of truth for ECS or WebGPU.

Recommended staged output:

1. Source status.
   - Already implemented: loader status, compact GLB source status, external
     buffer status, diagnostics.
2. Mesh-construction summary.
   - Mesh count, submesh count, vertex/index counts, and validity.
   - Derived from `meshConstruction`; no raw vertex or index arrays.
3. Asset-mapping summary.
   - Planned texture/material/sampler counts, validity, and diagnostics.
   - Derived from `assetMapping`; no decoded image bytes.
4. Source-registration summary.
   - Later: registry readiness and dependency edges after source assets are
     explicitly registered.
5. ECS command-plan summary.
   - Later: command counts and component families from replayable ECS authoring
     plans, still not direct ECS mutation.

## Ownership Rules

- Source/import summaries may report what was parsed, validated, or planned.
- ECS authoring happens only through explicit command-plan/replay contracts.
- WebGPU resources are prepared later by the renderer/backend from extracted
  render state and prepared assets.
- Browser status can display summaries, but must not expose raw bytes,
  registry internals, ECS world state, GPU handles, or scene graph objects.

## Selected Follow-Up

Implement `task-1934`: add source-loader output summary status tests. Start with
a JSON-safe output summary shape that can represent absent summaries, a present
mesh-construction summary, and an invalid mesh summary. Keep it no-fetch and
renderer-independent; do not route the browser example to the summary until the
shape is tested.
