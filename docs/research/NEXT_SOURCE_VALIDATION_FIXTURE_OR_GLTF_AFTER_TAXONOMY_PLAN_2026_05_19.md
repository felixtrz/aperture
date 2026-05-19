# Next Source Validation Fixture Or glTF Follow-Up After Taxonomy

Date: 2026-05-19

Task: `task-1716`

## Context

The source validation taxonomy defines candidate `customMaterialSource.*`
diagnostics and JSON-safe payload boundaries, but there is still no concrete
expected input/output fixture for future validators. A small fixture design can
make the next implementation step less ambiguous without exposing a public
custom material API.

Reference files inspected:

- `docs/research/CUSTOM_MATERIAL_SOURCE_VALIDATION_DIAGNOSTICS_TAXONOMY_2026_05_19.md`
- `docs/DECISIONS.md` Decision 0012
- `docs/DIAGNOSTICS_SUMMARIES.md`
- `docs/ARCHITECTURE.md`
- current material/glTF diagnostic tests under `test/materials` and `test/webgpu`

## Candidates

### Source Validation Fixture Candidate

Draft test-only expected input/output fixtures for future custom material source
validation diagnostics.

Pros:

- Directly follows the taxonomy and turns it into concrete examples future
  tests can lock.
- Keeps custom material source validation separate from route and WebGPU app
  diagnostics.
- Avoids implementing public custom material source APIs or validators too
  early.

Cons:

- Still docs/test-design only; runtime validation remains later.

Decision: select.

### StandardMaterial / glTF Fidelity Candidate

Add another browser-visible StandardMaterial/glTF fidelity proof.

Pros:

- Continues visible material fidelity.

Cons:

- The source validation track has a newly created taxonomy that should be made
  concrete before switching back to browser fidelity.

Decision: defer.

### Diagnostics / Tooling Candidate

Promote the taxonomy into `docs/DIAGNOSTICS_SUMMARIES.md`.

Pros:

- Moves the source validation boundary closer to public docs.

Cons:

- The public diagnostics page should wait until at least one expected fixture
  shape exists.

Decision: defer.

## Selected Follow-Up

### task-1718 — Draft custom material source validation fixture matrix

Category: `docs-tooling`
Package/write-scope:
`docs/research`; backlog/handoff docs only for run bookkeeping.
Reference anchor:
this plan,
`docs/research/CUSTOM_MATERIAL_SOURCE_VALIDATION_DIAGNOSTICS_TAXONOMY_2026_05_19.md`,
`docs/DECISIONS.md` Decision 0012, `docs/DIAGNOSTICS_SUMMARIES.md`, and current
material/glTF diagnostic tests.

Acceptance criteria:

- Draft a fixture matrix with representative invalid and valid-ish custom
  material source inputs and expected `customMaterialSource.*` diagnostics.
- Include JSON-safe expected output fields and explicitly exclude raw source
  objects, WebGPU handles, callbacks, cache maps, and source payload bytes.
- Keep the fixture matrix non-binding and do not add public custom material
  source APIs, runtime validators, app facade options, rendered custom families,
  IBL, shadows, or binary GLB loading.

## Next Step

Run `task-1717` to audit this selected follow-up plan before implementation.
