# Next Source Decision Or glTF Follow-Up After Source Checklist

Date: 2026-05-19

Task: `task-1706`

## Context

The custom material source/API design brief and source asset shape checklist now
identify the questions that must be answered before public custom material
source assets or public app-owned material adapter facades are implemented.
Decision 0011 still blocks those facades until a public source asset contract is
accepted.

Reference files inspected:

- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md` Decision 0011
- `docs/research/CUSTOM_MATERIAL_SOURCE_API_DESIGN_BRIEF_2026_05_18.md`
- `docs/research/CUSTOM_MATERIAL_SOURCE_ASSET_SHAPE_CHECKLIST_2026_05_18.md`
- `docs/research/NON_BUILT_IN_APP_MATERIAL_ADAPTER_DECOMPOSITION_2026_05_18.md`
- `packages/render/src/materials/types.ts`
- `references/bevy/crates/bevy_pbr/src/material.rs`
- `references/bevy/crates/bevy_render/src/render_asset.rs`

Reference commonality:

- Aperture's built-in material assets already separate source data from WebGPU
  resources and keep material `kind` closed.
- Bevy's material/render-asset pattern keeps source assets separate from
  prepared render assets and lets material families describe shader, binding,
  alpha/render-state, and specialization behavior.
- Aperture should adapt that concept as TypeScript data contracts with
  JSON-safe source assets and renderer-owned prepared resources, not Rust trait
  shapes or a public scene graph.

## Candidates

### Public Custom Material Source Shape Decision Candidate

Draft a narrow accepted decision record for the minimum public custom material
source asset shape.

Pros:

- Directly follows Decision 0011, the design brief, and the checklist.
- Converts non-binding research into an explicit architecture gate for later
  source validation work.
- Keeps the implementation scope docs-only and avoids public custom material
  APIs, app-owned adapter facades, shader loading, and non-built-in rendering.
- Gives future diagnostics and validation tasks a concrete source-shape target.

Cons:

- It does not add runtime behavior.
- The decision must stay minimal enough that it does not accidentally design a
  shader graph or app facade.

Decision: select.

### StandardMaterial / glTF Fidelity Candidate

Add browser-visible coverage for another StandardMaterial/glTF fidelity gap,
such as texture transform rotation or double-sided/alpha interaction reporting.

Pros:

- Adds visible rendering confidence.
- Continues the recent StandardMaterial texture and sampler fidelity track.

Cons:

- The current route/custom-material blocker is source-contract ambiguity after
  Decision 0011.
- Browser work would not answer the public source-shape gate.

Decision: defer.

### Diagnostics / Tooling Candidate

Promote route diagnostics examples or source-shape checklist content into a
public diagnostics/tooling page.

Pros:

- Helps agents and users inspect the current route diagnostic surfaces.
- Low implementation risk.

Cons:

- Public docs are less useful until the source-shape decision establishes which
  diagnostics belong to source validation versus route/preparation failures.

Decision: defer.

## Selected Follow-Up

### task-1708 — Add custom material source asset shape decision

Category: `docs-tooling`
Package/write-scope:
`docs/DECISIONS.md`; targeted architecture docs only if the decision exposes a
small alignment gap; backlog/handoff docs for run bookkeeping.
Reference anchor:
this plan, `docs/DECISIONS.md` Decision 0011,
`docs/ARCHITECTURE.md`, `docs/MEDIUM_LONG_TERM_GOALS.md`,
`docs/research/CUSTOM_MATERIAL_SOURCE_API_DESIGN_BRIEF_2026_05_18.md`,
`docs/research/CUSTOM_MATERIAL_SOURCE_ASSET_SHAPE_CHECKLIST_2026_05_18.md`,
`packages/render/src/materials/types.ts`,
`references/bevy/crates/bevy_pbr/src/material.rs`, and
`references/bevy/crates/bevy_render/src/render_asset.rs`.

Acceptance criteria:

- Add an accepted decision record that defines the minimum public custom
  material source asset shape at a policy level.
- The decision must keep source assets renderer-independent and JSON-safe, with
  stable family keys, serializable render-state and pipeline-key inputs,
  data-only binding/dependency declarations, and no raw WebGPU objects or
  callbacks.
- The decision must explicitly defer source validation implementation, app-owned
  adapter facade registration, shader loading, prepared-resource creation,
  non-built-in rendered pixels, IBL, shadows, and binary GLB loading.
- Run docs/format validation appropriate for a docs-only architecture decision.

## Next Step

Run `task-1707` to audit this selected follow-up plan before implementation.
