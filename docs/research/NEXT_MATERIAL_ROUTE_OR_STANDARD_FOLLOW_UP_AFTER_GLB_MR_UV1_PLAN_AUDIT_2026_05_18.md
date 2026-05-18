# Next Material Route Or Standard Follow-Up After GLB MR UV1 Plan Audit — 2026-05-18

## Scope

Audited the `task-1424` plan selecting combined GLB-derived base-color plus
metallic-roughness StandardMaterial browser coverage as the next follow-up.

Reference anchors:

- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/DECISIONS.md`
- `docs/research/NEXT_MATERIAL_ROUTE_OR_STANDARD_FOLLOW_UP_AFTER_GLB_MR_UV1_PLAN_2026_05_18.md`
- Existing StandardMaterial GLB texture-transform browser fixtures
- `references/bevy/crates/bevy_pbr/src/gltf.rs`
- `references/three.js/src/renderers/webgpu/utils/WebGPUTextureUtils.js`
- `references/engine/src/scene/materials/standard-material.js`

## Findings

- The selected follow-up is concrete enough for one focused run: one combined
  StandardMaterial fixture scenario, one browser/status regression, and targeted
  mapping fixes only if the fixture exposes a defect.
- The task preserves ECS authority because it continues using glTF-shaped source
  material data, typed asset registration, ECS mesh/material components, and the
  existing extracted render snapshot path.
- The task preserves WebGPU ownership because it verifies renderer-owned texture,
  sampler, material-buffer, bind-group, and pipeline resources through JSON-safe
  status rather than storing GPU handles on ECS components.
- The task advances `docs/MEDIUM_LONG_TERM_GOALS.md` by exercising multiple
  glTF StandardMaterial texture dependencies together before IBL, shadows, or
  broader PBR work.
- Scope boundaries are explicit: binary GLB loading, GLB viewer behavior, IBL,
  shadows, route renames, broad PBR completeness, and non-built-in material
  rendering stay deferred.

## Recommendation

Add `task-1426` to the ready backlog and implement it next. Pair it with a
small audit/tracker follow-up so browser coverage and public tracker status do
not drift.
