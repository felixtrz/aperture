# Standard glTF Metallic-Roughness Status Assertion Implementation Audit

Date: 2026-05-19

Task: `task-1744`

## Scope

Audit the `task-1743` metallic-roughness status assertion update.

Reference files inspected:

- `docs/research/NEXT_STANDARD_GLTF_ASSERTION_AFTER_COMBINED_EMISSIVE_PLAN_2026_05_19.md`
- `docs/research/STANDARD_GLTF_METALLIC_ROUGHNESS_STATUS_ASSERTION_PLAN_AUDIT_2026_05_19.md`
- `test/e2e/standard-gltf-texture.spec.ts`
- `examples/standard-gltf-texture.js`

## Findings

- Added exact `expectedMetallicRoughness.metallic` and `.roughness` assertions
  to the standalone metallic-roughness, combined base-color/metallic-roughness,
  and combined base-color/metallic-roughness/normal browser tests.
- The assertions pin the fixture's base texture channel values: metallic
  `64 / 255` and roughness `16 / 255`.
- Existing screenshot/readback, diagnostics, and WebGPU warning checks remain
  unchanged.
- No shader code, example behavior, public API, custom material source API,
  app-owned adapter facade, IBL, shadows, binary GLB loading, or new rendered
  scenario changed.

## Validation

- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts -g "(mapped metallic-roughness texture|combined base-color and metallic-roughness textures|combined base-color metallic-roughness and normal textures)"`

## Recommendation

Proceed to tracker/backlog alignment. The next useful run can continue
assertion hardening or select a larger StandardMaterial/glTF fidelity gap.
