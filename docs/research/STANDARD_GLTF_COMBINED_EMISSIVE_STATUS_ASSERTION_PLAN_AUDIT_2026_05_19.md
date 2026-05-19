# Standard glTF Combined Emissive Status Assertion Plan Audit

Date: 2026-05-19

Task: `task-1737`

## Scope

Audit the `task-1736` selected follow-up before implementation.

Reference files inspected:

- `docs/research/NEXT_STANDARD_GLTF_FIDELITY_AFTER_EMISSIVE_ASSERTION_PLAN_2026_05_19.md`
- `test/e2e/standard-gltf-texture.spec.ts`
- `examples/standard-gltf-texture.js`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/ARCHITECTURE.md`

## Findings

- The selected follow-up is concrete and limited to existing combined browser
  fixtures.
- It preserves ECS authority and render extraction boundaries because it only
  tightens assertions over JSON-safe example status.
- It does not require shader changes, new scenarios, package exports, public
  custom material APIs, app-owned adapter facades, IBL, shadows, or binary GLB
  loading.
- The focused validation should run the two combined emissive Playwright tests.

## Recommendation

Implement `task-1738` as selected by replacing broad array matchers with exact
emissive factor/color assertions in the two combined browser tests.
