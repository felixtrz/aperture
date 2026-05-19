# Standard glTF Assertion Hardening Audit

Date: 2026-05-19

Task: `task-1753`

## Scope

Review the recent StandardMaterial/glTF assertion hardening slices:

- standalone emissive texture exact factor/color status;
- combined emissive exact factor/color status;
- standalone and combined metallic-roughness exact channel status; and
- standalone, strength, and combined occlusion exact red-channel status.

Reference files inspected:

- `test/e2e/standard-gltf-texture.spec.ts`
- `examples/standard-gltf-texture.js`
- `docs/research/STANDARD_GLTF_EMISSIVE_FACTOR_TEXTURE_ASSERTION_IMPLEMENTATION_AUDIT_2026_05_19.md`
- `docs/research/STANDARD_GLTF_COMBINED_EMISSIVE_STATUS_ASSERTION_IMPLEMENTATION_AUDIT_2026_05_19.md`
- `docs/research/STANDARD_GLTF_METALLIC_ROUGHNESS_STATUS_ASSERTION_IMPLEMENTATION_AUDIT_2026_05_19.md`
- `docs/research/STANDARD_GLTF_OCCLUSION_STATUS_ASSERTION_IMPLEMENTATION_AUDIT_2026_05_19.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/ARCHITECTURE.md`

## Findings

- The new assertions are all over existing JSON-safe browser status fields and
  do not change example behavior, shader code, resource preparation, app
  facades, public APIs, or source material contracts.
- The assertions add useful signal because they pin glTF semantic values that
  previously used broad `expect.any(...)` matchers:
  - emissive factor `[0.9, 0.25, 0.08]`;
  - emissive texture color `[1, 0.5, 0.125, 1]`;
  - metallic channel `64 / 255`;
  - roughness channel `16 / 255`; and
  - occlusion red channel `32 / 255`.
- The changes overlap intentionally across standalone and combined fixtures.
  This is useful because combined material routes can regress status assembly
  independently from standalone routes.
- Existing screenshot/readback and WebGPU warning checks remain the primary
  pixel/rendering proof. The new assertions are status-fidelity guards rather
  than replacements for pixel checks.
- No ECS/render ownership drift was introduced. ECS remains authoritative,
  rendering remains derived, WebGPU stays the only backend, and custom material
  source APIs/app-owned adapter facades remain deferred.

## Remaining Gaps

- Several status surfaces still use broad matchers for alpha-mask and alpha-blend
  source/status values.
- Some transformed texture fixtures prove pixels but could still use clearer
  exact status assertions around transform values and sampled UV expectations.
- Assertion hardening is now enough for this narrow sweep; another immediate
  assertion-only slice has diminishing returns unless it targets alpha or
  transform status.

## Recommendation

For the next focused StandardMaterial/glTF task, choose one of:

1. alpha/render-state status hardening for existing alpha-mask and alpha-blend
   fixtures; or
2. transform-status hardening for existing texture transform fixtures.

Prefer alpha/render-state status first if staying in assertion cleanup because
it exercises material render-state mapping, pipeline keys, culling, and pixel
expectations together without adding new renderer features.
