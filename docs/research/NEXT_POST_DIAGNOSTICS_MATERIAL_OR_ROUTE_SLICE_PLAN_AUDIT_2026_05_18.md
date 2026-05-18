# Next Post-Diagnostics Material Or Route Slice Plan Audit

Date: 2026-05-18

## Scope

Audit the plan that selected an invalid glTF texture scalar browser diagnostic
as the next implementation slice.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/NEXT_POST_DIAGNOSTICS_MATERIAL_OR_ROUTE_SLICE_PLAN_2026_05_18.md`
- `docs/research/INVALID_GLTF_MATERIAL_SCALAR_BROWSER_DIAGNOSTIC_AUDIT_2026_05_18.md`
- `packages/render/src/materials/gltf-material.ts`

## Findings

Pass. The selected follow-up is a concrete one-run task and stays on the
render-bridge diagnostics surface.

The invalid texture scalar fixture should exercise existing glTF material mapper
validation for texture-specific scalar fields such as `occlusionTexture.strength`
or `normalTexture.scale`. It should fail before registration/rendering and
assert JSON-safe field/value status, mirroring the scalar-factor diagnostic
without adding new rendering behavior.

Boundary checks:

- ECS remains authoritative; invalid asset mapping prevents renderable material
  state from being registered.
- Render extraction remains derived from ECS and asset state.
- WebGPU remains backend-only, with the test expected to assert no resource
  creation or draw submission.
- App-level custom material routes, binary GLB loading, IBL, shadows, and GLB
  viewer behavior remain deferred.

## Recommendation

Implement `task-1322` next.

## Validation

- Documentation-only audit; covered by final formatting and diff checks.
