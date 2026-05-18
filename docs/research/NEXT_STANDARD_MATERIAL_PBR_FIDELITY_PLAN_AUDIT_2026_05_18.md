# Next StandardMaterial PBR Fidelity Plan Audit

Date: 2026-05-18

## Scope

Audit
`docs/research/NEXT_STANDARD_MATERIAL_PBR_FIDELITY_SLICE_PLAN_2026_05_18.md`
before implementation.

## References Inspected

- `docs/research/NEXT_STANDARD_MATERIAL_PBR_FIDELITY_SLICE_PLAN_2026_05_18.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/ARCHITECTURE.md`
- `docs/NORTH_STAR.md`

## Findings

The selected slice is narrow enough:

- It targets one existing StandardMaterial slot:
  `metallicRoughnessTexture`.
- It limits transform support to the already-proven `TEXCOORD_0` offset/scale
  case.
- It keeps rotation, `TEXCOORD_1`, and broad all-slot transform support
  deferred unless implementation proves a reusable path safely.
- It requires diagnostics to remain honest for unsupported cases.

The plan does not jump ahead:

- No IBL.
- No shadows.
- No new BRDF work.
- No GLB viewer.
- No normal tangent changes.
- No new app diagnostics fields.

## Validation Requirements

Implementation should include:

- targeted unit coverage for glTF mapping/readiness/uniform packing;
- WGSL coverage for transform metadata or shader text where practical;
- browser/readback coverage proving transformed metallic-roughness sampling
  affects output deterministically;
- regression coverage that unsupported transform cases remain diagnostic-only
  unless intentionally changed.

## Outcome

The plan is safe to implement as `task-1199`. Keep the implementation focused
on metallic-roughness `TEXCOORD_0` offset/scale transform support and leave
lighting/shadow work deferred.
