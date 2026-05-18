# Standard GLB Texture Helper Extraction Audit

Date: 2026-05-18

## Scope

Audit the helper extraction in `examples/standard-gltf-texture.js` after the
delayed-dependency readiness and alpha-mask backface fixtures landed.

This audit checks whether shared helpers hide scenario-specific assertions,
publish broader claims than the fixtures prove, or create enough duplication to
justify another cleanup now.

## References Inspected

- `docs/research/GLB_DELAYED_DEPENDENCY_BROWSER_STATUS_AUDIT_2026_05_18.md`
- `docs/research/STANDARD_MATERIAL_ALPHA_MASK_COVERAGE_AUDIT_2026_05_18.md`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`

## Findings

The helper extraction stayed within the current fixture boundaries:

- `alphaMaskSourceForConfig` only selects between scalar double-sided mask,
  textured mask, and backface mask source metadata.
- `materialNameForConfig` centralizes labels, but it does not change pipeline
  keys, material fields, diagnostics, or test assertions.
- `readbackSamplesForConfig` keeps scenario-specific sample sets explicit:
  alpha-mask texture uses opaque and masked samples, backface uses a backface
  sample, and the texture fixtures keep the existing centered textured sample.
- Delayed dependency status still publishes GLB-shaped base-color and normal
  dependency keys and now includes slot-level StandardMaterial texture readiness.
- The browser tests still assert the scenario-specific expected diagnostics,
  pipeline keys, resource counts, readback samples, JSON safety, and no raw GPU
  resources.

The helpers do not claim unsupported behavior. In particular, the current tests
still do not claim binary `.glb` loading, transparent blending correctness,
rotation-based texture transforms, IBL, shadows, or generalized two-sided
lighting.

## Remaining Duplication

The test file still repeats similar setup/assertion blocks across texture slots
and alpha-mask variants. That duplication is acceptable for now because the
scenarios are still evolving and explicit assertions make each fixture's proof
surface clear.

The next useful cleanup would be a small typed expectation builder for repeated
`standardTexture` mapping fields after texture-transform sampling support lands.
Doing it now would likely obscure the current fixture-specific checks more than
it would help.

## Follow-Ups

- No corrective code change was needed for this audit.
- Revisit Playwright expectation helper extraction after `task-1148` adds
  transformed base-color sampling.
