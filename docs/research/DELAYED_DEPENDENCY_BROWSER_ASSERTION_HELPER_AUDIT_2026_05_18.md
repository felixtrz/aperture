# Delayed dependency browser assertion helper audit - 2026-05-18

## Scope

Audit whether the delayed-dependency browser assertions in
`standard-gltf-texture.spec.ts` should be extracted into shared helpers after
base/normal, metallic-roughness, and occlusion/emissive coverage.

Reference anchors inspected:

- `docs/ARCHITECTURE.md`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`
- recent StandardMaterial/glTF dependency diagnostics audits

## Findings

- There is repeated structure across delayed-dependency assertions:
  material dependency readiness, standard texture readiness, no draw submission,
  no pipeline keys, and JSON-safe status.
- The slot-specific details are still the most important part of each test.
  Base/normal covers four dependency states, metallic-roughness covers one
  texture plus one sampler, and occlusion/emissive covers two different slots.
- A broad helper would either need many parameters or would hide the
  slot-specific field/key/status expectations that make these diagnostics useful
  to agents.

## Recommendation

Do not extract a shared helper yet. Keep the assertions local until one more
dependency fixture or a focused readability issue makes the helper shape
obvious. A future helper should probably assert only common no-work invariants
and leave slot-specific dependency/readiness checks inline.

## Validation

Documentation-only audit; covered by final formatting/check validation.
