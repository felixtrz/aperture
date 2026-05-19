# Standard glTF Emissive Factor Texture Assertion Plan Audit

Date: 2026-05-19

Task: `task-1732`

## Scope

Audit the `task-1731` selected follow-up before implementation.

Reference files inspected:

- `docs/research/NEXT_STANDARD_GLTF_FIDELITY_AFTER_SOURCE_DIAGNOSTICS_DOCS_PLAN_2026_05_19.md`
- `packages/webgpu/src/webgpu/standard-shader.ts`
- `test/webgpu/standard-shader.test.ts`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/ARCHITECTURE.md`

## Findings

- The selected follow-up is concrete enough for one focused run and uses an
  existing browser scenario.
- The WGSL shader contract already covers emissive texture multiplication with
  `material.emissiveFactor * emissiveSample.rgb`; the browser test can tighten
  the JSON-safe status assertion without changing shader code.
- The scope preserves ECS authority and render extraction boundaries because it
  changes only Playwright assertions over existing app status and pixels.
- The task does not require public custom material APIs, package-level source
  validators, app-owned adapter facades, IBL, shadows, binary GLB loading, or
  new rendered scenarios.

## Recommendation

Implement `task-1733` by updating the existing emissive texture browser test to
assert exact `expectedEmissive.factor` and `expectedEmissive.color` values.
