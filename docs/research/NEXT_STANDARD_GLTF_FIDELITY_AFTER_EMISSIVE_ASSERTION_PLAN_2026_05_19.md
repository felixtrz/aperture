# Next Standard glTF Fidelity After Emissive Assertion

Date: 2026-05-19

Task: `task-1736`

## Context

The standalone mapped emissive texture scenario now asserts exact
`expectedEmissive.factor` and `expectedEmissive.color` values. The combined
StandardMaterial/glTF fixtures still only assert that those values are arrays.

Reference files inspected:

- `test/e2e/standard-gltf-texture.spec.ts`
- `examples/standard-gltf-texture.js`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/ARCHITECTURE.md`
- recent StandardMaterial/glTF audits

## Candidates

### Combined Emissive Status Assertion Candidate

Tighten the combined base-color/occlusion/emissive and base-color/alpha-mask/
emissive browser fixtures so their `expectedEmissive` status asserts exact
factor and color values.

Pros:

- Extends the just-landed emissive assertion to combined material routes.
- Uses existing scenarios and status payloads.
- Keeps the work limited to Playwright assertions and focused browser
  validation.

Cons:

- Assertion hardening only; no new scenario.

Decision: select.

### Texture Transform Fidelity Candidate

Add a new texture-transform assertion or browser scenario.

Pros:

- Texture transform behavior is important for glTF fidelity.

Cons:

- Existing transformed sampling coverage is already broad, while combined
  emissive status can be tightened with less risk.

Decision: defer.

### Route / Diagnostics Candidate

Return to package-level source validation planning.

Pros:

- Continues the source diagnostics track.

Cons:

- The tracker now intentionally biases back to StandardMaterial/glTF fidelity.

Decision: defer.

## Selected Follow-Up

### task-1738 — Tighten combined emissive status assertions

Category: `webgpu-render`
Package/write-scope:
`test/e2e/standard-gltf-texture.spec.ts`.
Reference anchor:
this plan, `examples/standard-gltf-texture.js`, and
`test/e2e/standard-gltf-texture.spec.ts`.

Acceptance criteria:

- Update the combined base-color/occlusion/emissive browser test to assert exact
  `expectedEmissive.factor` and `expectedEmissive.color` values.
- Update the combined base-color/alpha-mask/emissive browser test with the same
  exact status assertion.
- Preserve existing screenshot/readback, alpha-mask, diagnostics, and WebGPU
  warning checks.
- Do not add new scenarios, public custom material APIs, app-owned adapter
  facades, IBL, shadows, or binary GLB loading.

## Next Step

Run `task-1737` to audit this selected follow-up plan before implementation.
