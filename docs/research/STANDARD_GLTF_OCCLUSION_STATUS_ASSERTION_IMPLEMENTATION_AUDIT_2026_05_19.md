# Standard glTF Occlusion Status Assertion Implementation Audit

Date: 2026-05-19

Task: `task-1749`

## Scope

Audit the `task-1748` occlusion status assertion update.

Reference files inspected:

- `docs/research/NEXT_GLTF_ASSERTION_AFTER_METALLIC_ROUGHNESS_PLAN_2026_05_19.md`
- `docs/research/STANDARD_GLTF_OCCLUSION_STATUS_ASSERTION_PLAN_AUDIT_2026_05_19.md`
- `test/e2e/standard-gltf-texture.spec.ts`
- `examples/standard-gltf-texture.js`

## Findings

- Added exact `expectedOcclusion.red` assertions to the standalone occlusion,
  occlusion-strength, and combined base-color/occlusion/emissive browser tests.
- The assertions pin the fixture's base occlusion red-channel value `32 / 255`
  while preserving existing strength checks for `1` and `0.25`.
- Existing screenshot/readback, diagnostics, and WebGPU warning checks remain
  unchanged.
- No shader code, example behavior, public API, custom material source API,
  app-owned adapter facade, IBL, shadows, binary GLB loading, or new rendered
  scenario changed.

## Validation

- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts -g "(combined base-color occlusion and emissive|mapped occlusion texture|occlusion texture strength)"`

## Recommendation

Proceed to tracker/backlog alignment. The next run can continue focused
assertion hardening or pick a larger browser-verifiable StandardMaterial/glTF
gap.
