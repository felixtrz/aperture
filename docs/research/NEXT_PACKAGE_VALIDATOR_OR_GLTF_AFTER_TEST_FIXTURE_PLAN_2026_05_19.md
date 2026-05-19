# Next Package Validator Or glTF Follow-Up After Test Fixture

Date: 2026-05-19

Task: `task-1726`

## Context

The custom material source track now has Decision 0012, a non-binding taxonomy,
a fixture matrix, and a local test-only validator guardrail. The next step
should avoid turning those guardrails into a public source API too quickly.

Reference files inspected:

- `test/materials/custom-material-source-validation-fixture.test.ts`
- `docs/research/CUSTOM_MATERIAL_SOURCE_VALIDATION_FIXTURE_MATRIX_2026_05_19.md`
- `docs/research/CUSTOM_MATERIAL_SOURCE_VALIDATION_DIAGNOSTICS_TAXONOMY_2026_05_19.md`
- `docs/DIAGNOSTICS_SUMMARIES.md`
- `docs/DECISIONS.md` Decision 0012
- `docs/ARCHITECTURE.md`

## Candidates

### Package-Level Validator Candidate

Move the test-only helper into `packages/render` as an internal or exported
validator surface.

Pros:

- Would make the guardrail reusable outside the test file.

Cons:

- The exact public TypeScript source shape has not been accepted.
- An exported validator could be mistaken for public custom material source API
  support before app-owned adapters, dependency validation, and preparation
  contracts exist.

Decision: defer.

### StandardMaterial / glTF Fidelity Candidate

Return to browser-visible StandardMaterial/glTF fidelity coverage.

Pros:

- Continues rendered-pixel confidence after several source-design tasks.

Cons:

- The diagnostics docs now lag behind Decision 0012 and the executable guardrail.
  A small docs update can close that gap before switching tracks.

Decision: defer for one more small docs slice.

### Diagnostics / Tooling Candidate

Promote the custom material source validation boundary into
`docs/DIAGNOSTICS_SUMMARIES.md`.

Pros:

- Makes the source-vs-route diagnostics boundary visible in the public
  diagnostics inventory.
- Can reference Decision 0012, the taxonomy, and the test-only guardrail without
  claiming public custom material support.
- Keeps package validation and app facade work deferred.

Cons:

- Docs-only.

Decision: select.

## Selected Follow-Up

### task-1728 — Document custom material source validation boundary

Category: `docs-tooling`
Package/write-scope:
`docs/DIAGNOSTICS_SUMMARIES.md`; targeted tracker/backlog docs for bookkeeping.
Reference anchor:
this plan, `docs/DECISIONS.md` Decision 0012,
`docs/research/CUSTOM_MATERIAL_SOURCE_VALIDATION_DIAGNOSTICS_TAXONOMY_2026_05_19.md`,
`docs/research/CUSTOM_MATERIAL_SOURCE_VALIDATION_FIXTURE_MATRIX_2026_05_19.md`,
and `test/materials/custom-material-source-validation-fixture.test.ts`.

Acceptance criteria:

- Add a concise diagnostics-summary section for future custom material source
  validation diagnostics.
- Explain that `customMaterialSource.*` diagnostics are source-shape diagnostics
  and remain separate from route, dependency, preparation, frame-resource,
  pipeline, and app facade diagnostics.
- Reference JSON-safe payload limits and state that public custom material APIs,
  package validators, app-owned adapter facades, rendered custom families, IBL,
  shadows, and binary GLB loading remain deferred.

## Next Step

Run `task-1727` to audit this selected follow-up plan before implementation.
