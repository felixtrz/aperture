# Occlusion/emissive dependency diagnostics plan audit - 2026-05-18

## Scope

Audit the selected follow-up from
`NEXT_ROUTE_OR_STANDARD_AFTER_DEPENDENCY_GAP_AUDIT_PLAN_2026_05_18.md`.

Reference anchors inspected:

- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_DEPENDENCY_GAP_AUDIT_PLAN_2026_05_18.md`
- `docs/research/STANDARD_GLTF_TEXTURE_DEPENDENCY_GAP_AUDIT_AFTER_METALLIC_ROUGHNESS_2026_05_18.md`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`

## Audit

The selected follow-up is concrete enough for one focused run:

- It has one fixture shape: a GLB-style StandardMaterial with occlusion and
  emissive texture bindings.
- It can mark one dependency loading and one dependency failed using the same
  source asset status path as existing delayed dependency scenarios.
- It has explicit no-work expectations: no draw submission, no pipeline keys,
  and no prepared texture/sampler/material resources.

Architecture fit:

- The source material remains renderer-independent glTF-derived data.
- The renderer must not invent fallback occlusion or emissive resources when
  dependencies are unavailable.
- Status must remain JSON-safe and omit raw GPU handles.
- The task does not require binary GLB loading, IBL, shadows, broad PBR work, or
  app-level non-built-in rendering.

## Recommendation

Implement `task-1542` after tracker alignment. Keep helper extraction optional:
only extract shared delayed-dependency assertions if the implementation would
otherwise duplicate enough code to obscure the slot-specific checks.

## Validation

Documentation-only audit; covered by final formatting/check validation.
