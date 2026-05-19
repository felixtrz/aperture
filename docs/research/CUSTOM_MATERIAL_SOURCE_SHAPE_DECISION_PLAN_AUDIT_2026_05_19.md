# Custom Material Source Shape Decision Plan Audit

Date: 2026-05-19

Task: `task-1707`

## Scope

Audit the `task-1706` selected follow-up before implementation.

Reference files inspected:

- `docs/research/NEXT_SOURCE_DECISION_OR_GLTF_AFTER_SOURCE_CHECKLIST_PLAN_2026_05_19.md`
- `docs/research/CUSTOM_MATERIAL_SOURCE_API_DESIGN_BRIEF_2026_05_18.md`
- `docs/research/CUSTOM_MATERIAL_SOURCE_ASSET_SHAPE_CHECKLIST_2026_05_18.md`
- `docs/DECISIONS.md` Decision 0011
- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `packages/render/src/materials/types.ts`
- `references/bevy/crates/bevy_pbr/src/material.rs`
- `references/bevy/crates/bevy_render/src/render_asset.rs`

## Findings

- The selected follow-up is concrete enough for one focused run: add one
  architecture decision record for the public custom material source asset shape.
- The plan preserves Decision 0011 because it decides only source asset shape
  policy; it does not expose app-owned adapter facades or implement public
  custom material rendering.
- The planned constraints preserve ECS authority and render extraction
  boundaries because source assets stay data-only, JSON-safe, and free of raw
  WebGPU objects, callbacks, prepared-resource caches, or renderer-owned state.
- The plan aligns with the Bevy material/render-asset reference conceptually:
  source material data, material-family behavior, and prepared render resources
  remain separate concerns. Aperture should keep this as a TypeScript data
  contract rather than adopting Bevy's Rust trait/plugin shape.
- The plan should avoid specifying exact TypeScript interfaces beyond the
  minimum policy needed for follow-up validation tasks; detailed validators,
  dependency reports, shader asset registration, and prepared-resource adapters
  should remain separate tasks.

## Recommendation

Implement `task-1708` as selected: add the custom material source asset shape
decision record. Do not touch runtime code, app facade options, package exports,
examples, shaders, browser tests, IBL, shadows, binary GLB loading, or public
non-built-in material rendering in this slice.
