# Metallic-Roughness Factor Browser Proof Audit

Date: 2026-05-18

Task: `task-1674`

## Scope

Audit the `task-1673` browser proof for metallic-roughness scalar factors
combined with a metallic-roughness texture.

Reference files inspected:

- `docs/research/NEXT_APP_ADAPTER_OR_GLTF_AFTER_SHADER_CONTRACT_PLAN_2026_05_18.md`
- `docs/research/NEXT_APP_ADAPTER_OR_GLTF_AFTER_SHADER_CONTRACT_PLAN_AUDIT_2026_05_18.md`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`

## Findings

- Added a `metallic-roughness-factor-texture` glTF-shaped browser scenario with
  non-default `metallicFactor` and `roughnessFactor` plus a mapped
  `metallicRoughnessTexture`.
- Status now exposes JSON-safe channel values, scalar factors, and multiplied
  expected metallic/roughness values for that scenario.
- Playwright coverage verifies the scenario renders, uses the expected
  metallic-roughness texture pipeline, reports ready texture dependencies, and
  produces non-clear screenshot pixels.
- The change does not add app-level non-built-in rendering, public custom
  material source APIs, binary GLB loading, IBL, shadows, or new GPU resource
  ownership patterns.

## Validation

- `node --check examples/standard-gltf-texture.js`
- `pnpm run typecheck:test`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts -g "metallic-roughness scalar factors"`

## Recommendation

Align tracker/backlog state. The next planning pass can choose between app-level
adapter registration policy/decision work and another browser-level
StandardMaterial/glTF fidelity slice.
