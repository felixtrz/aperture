# Standard glTF Combined Emissive Status Assertion Implementation Audit

Date: 2026-05-19

Task: `task-1739`

## Scope

Audit the `task-1738` combined browser assertion update.

Reference files inspected:

- `docs/research/NEXT_STANDARD_GLTF_FIDELITY_AFTER_EMISSIVE_ASSERTION_PLAN_2026_05_19.md`
- `docs/research/STANDARD_GLTF_COMBINED_EMISSIVE_STATUS_ASSERTION_PLAN_AUDIT_2026_05_19.md`
- `test/e2e/standard-gltf-texture.spec.ts`
- `examples/standard-gltf-texture.js`

## Findings

- Tightened the combined base-color/occlusion/emissive and base-color/
  alpha-mask/emissive browser tests to assert exact
  `expectedEmissive.factor` and `expectedEmissive.color` values.
- Both combined fixtures now pin the same non-default emissive factor
  `[0.9, 0.25, 0.08]` and sampled emissive texture color
  `[1, 0.5, 0.125, 1]` as the standalone emissive texture test.
- Existing screenshot/readback checks, alpha-mask checks, diagnostics checks,
  and WebGPU warning guards remain unchanged.
- No shader code, example behavior, public API, custom material source API,
  app-owned adapter facade, IBL, shadows, binary GLB loading, or new rendered
  scenario changed.

## Validation

- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts -g "combined base-color (occlusion and emissive|alpha-mask and emissive)"`

## Recommendation

Proceed to tracker/backlog alignment. A next small glTF fidelity candidate is
another exact-status assertion over existing combined texture fixtures, or an
audit can choose a larger browser-verifiable gap.
