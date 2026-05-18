# Standard glTF Normal Scale Browser Plan Audit - 2026-05-18

## Scope

Audit the selected follow-up from
`NEXT_ROUTE_OR_STANDARD_AFTER_OCCLUSION_STRENGTH_PLAN_2026_05_18.md`.

Reference anchors inspected:

- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/DECISIONS.md`
- `docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_OCCLUSION_STRENGTH_PLAN_2026_05_18.md`
- `docs/research/STANDARD_GLTF_OCCLUSION_STRENGTH_BROWSER_COVERAGE_AUDIT_2026_05_18.md`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`
- `packages/render/src/materials/gltf-material.ts`
- `packages/webgpu/src/webgpu/standard-shader.ts`

## Findings

The selected follow-up is concrete enough for one focused implementation run.
It mirrors the occlusion strength slice: a scalar glTF texture property already
flows through source mapping, material uniforms, and shader logic, but lacks
browser-level proof.

The implementation should:

- add one new scenario instead of changing the existing normal-map fixture;
- compare against the existing normal-map control;
- assert JSON-safe status, tangent mesh layout, resources, and pipeline key;
- avoid broader normal-map or lighting refactors unless the fixture exposes a
  focused defect.

## Recommendation

Proceed with the normal texture scale browser fixture. Keep validation focused
on `node --check`, the targeted Playwright test, and type checking.

## Validation

Documentation-only audit; covered by final formatting and progress checks.
