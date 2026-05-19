# Standard glTF Metallic-Roughness Status Assertion Plan Audit

Date: 2026-05-19

Task: `task-1742`

## Scope

Audit the `task-1741` selected follow-up before implementation.

Reference files inspected:

- `docs/research/NEXT_STANDARD_GLTF_ASSERTION_AFTER_COMBINED_EMISSIVE_PLAN_2026_05_19.md`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/ARCHITECTURE.md`

## Findings

- The selected follow-up is concrete and limited to existing browser fixtures.
- The exact values come from the fixture's stable `metallicRoughness` constants:
  metallic `64 / 255` and roughness `16 / 255`.
- The task changes only Playwright assertions over JSON-safe status and
  preserves ECS/render ownership boundaries.
- It does not require shader changes, new scenarios, public custom material
  APIs, app-owned adapter facades, IBL, shadows, or binary GLB loading.

## Recommendation

Implement `task-1743` as selected and run the three affected metallic-roughness
browser tests.
