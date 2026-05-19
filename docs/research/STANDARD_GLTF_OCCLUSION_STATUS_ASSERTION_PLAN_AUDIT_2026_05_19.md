# Standard glTF Occlusion Status Assertion Plan Audit

Date: 2026-05-19

Task: `task-1747`

## Scope

Audit the `task-1746` selected follow-up before implementation.

Reference files inspected:

- `docs/research/NEXT_GLTF_ASSERTION_AFTER_METALLIC_ROUGHNESS_PLAN_2026_05_19.md`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/ARCHITECTURE.md`

## Findings

- The selected follow-up is concrete and limited to existing browser fixtures.
- The exact red-channel value comes from the fixture's stable occlusion texture
  constant: `32 / 255`.
- The work changes only Playwright assertions over JSON-safe status and keeps
  current screenshot/readback behavior intact.
- It does not require shader changes, new examples, public APIs, custom material
  APIs, app-owned adapter facades, IBL, shadows, or binary GLB loading.

## Recommendation

Implement `task-1748` as selected and run the focused occlusion browser tests.
