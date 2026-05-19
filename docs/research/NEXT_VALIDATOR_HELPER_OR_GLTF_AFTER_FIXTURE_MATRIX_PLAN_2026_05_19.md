# Next Validator Helper Or glTF Follow-Up After Fixture Matrix

Date: 2026-05-19

Task: `task-1721`

## Context

The custom material source validation taxonomy and fixture matrix now describe
candidate diagnostics and expected JSON-safe records. The next useful source
validation step is to lock those examples in a test-only helper without
exporting runtime APIs or implying public custom material rendering support.

Reference files inspected:

- `docs/research/CUSTOM_MATERIAL_SOURCE_VALIDATION_FIXTURE_MATRIX_2026_05_19.md`
- `docs/research/CUSTOM_MATERIAL_SOURCE_VALIDATION_DIAGNOSTICS_TAXONOMY_2026_05_19.md`
- `docs/DECISIONS.md` Decision 0012
- `docs/ARCHITECTURE.md`
- `test/materials/standard-proof-point.test.ts`
- `test/materials/gltf-report-json.test.ts`

## Candidates

### Test-Only Validator Helper Candidate

Add a focused `test/materials` fixture that defines a local test-only custom
source validator helper and asserts expected `customMaterialSource.*`
diagnostics for the fixture matrix.

Pros:

- Converts the matrix into executable guardrails without adding package exports.
- Keeps the validator local to tests, so it cannot be mistaken for a public API.
- Gives future implementation work concrete expected diagnostic field shapes.

Cons:

- It is not production validation and should stay clearly test-only.

Decision: select.

### StandardMaterial / glTF Fidelity Candidate

Return to browser-visible StandardMaterial/glTF fidelity.

Pros:

- Continues rendered-pixel confidence.

Cons:

- The source validation fixture matrix is ready for a tiny executable guardrail.

Decision: defer.

### Diagnostics / Tooling Candidate

Promote the source validation taxonomy and fixture matrix into public
diagnostics docs.

Pros:

- Improves public discoverability of the source-vs-route diagnostics boundary.

Cons:

- Public docs should wait until the executable guardrail proves the field shape
  is reasonable.

Decision: defer.

## Selected Follow-Up

### task-1723 — Add test-only custom material source validation fixture

Category: `docs-tooling`
Package/write-scope:
`test/materials/custom-material-source-validation-fixture.test.ts` and targeted
research notes only if needed.
Reference anchor:
this plan,
`docs/research/CUSTOM_MATERIAL_SOURCE_VALIDATION_FIXTURE_MATRIX_2026_05_19.md`,
`docs/research/CUSTOM_MATERIAL_SOURCE_VALIDATION_DIAGNOSTICS_TAXONOMY_2026_05_19.md`,
`docs/DECISIONS.md` Decision 0012, and existing `test/materials` diagnostic
fixture style.

Acceptance criteria:

- Add a test-only local validator helper that checks representative fixture
  records and returns `customMaterialSource.*` diagnostics.
- Cover valid minimal shape, invalid discriminator/family key, reserved family,
  render-state failure, malformed binding/dependency, metadata warning, and live
  renderer object/callback rejection.
- Assert JSON output omits raw source objects, WebGPU handles, callbacks, cache
  maps, typed arrays, and source payload bytes.
- Do not export the helper, add public custom material source APIs, add app
  facade options, render custom families, IBL, shadows, or binary GLB loading.

## Next Step

Run `task-1722` to audit this selected follow-up plan before implementation.
