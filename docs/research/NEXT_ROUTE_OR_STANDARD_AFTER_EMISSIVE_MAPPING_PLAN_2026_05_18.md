# Next Route Or Standard Follow-Up After Emissive Mapping Coverage

Date: 2026-05-18

Task: `task-1610`

## Context

`task-1607` added mapper-level coverage for valid glTF `emissiveFactor` without
`emissiveTexture`. The adjacent narrow gap is invalid `emissiveFactor`
diagnostics at the same render-bridge boundary.

## Candidates

### Material Route / Prepared-Resource Candidate

Start another route/prepared-resource cleanup.

Pros:

- Keeps pressure on generic route contracts.

Cons:

- Recent route work already added successful and failure field-shape
  regressions.
- The immediately adjacent mapper diagnostic gap is smaller and directly
  follows the valid emissive-factor mapping test.

Decision: defer.

### StandardMaterial / glTF Fidelity Candidate

Add a mapper-level invalid `emissiveFactor` regression.

Pros:

- Completes the positive/negative render-bridge mapping pair for
  emissive-factor-only authoring.
- Stays independent of WebGPU and browser runtime behavior.
- Can assert the fallback emissive factor and JSON-safe invalid-field
  diagnostic.

Cons:

- Unit-level coverage only; no new rendered behavior.

Decision: select.

### Diagnostics / Tooling Candidate

Only update tracker/backlog state after emissive mapping coverage.

Pros:

- Low risk.

Cons:

- Already handled by `task-1609`.

Decision: complete; no tooling-only follow-up now.

## Selected Follow-Up

### task-1612 — Add invalid emissive-factor glTF mapping regression

Category: `render-bridge`
Package/write-scope: `test/materials/gltf-material.test.ts`.
Reference anchor:
this plan, `docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`packages/render/src/materials/gltf-material.ts`, and the existing glTF
material mapping tests.

Acceptance criteria:

- Add a mapper-level regression where `emissiveFactor` is malformed.
- Assert the mapped StandardMaterial falls back to `[0, 0, 0]`, remains a
  StandardMaterial, marks the report invalid, and emits a JSON-safe
  `gltfMaterial.invalidField` diagnostic for `emissiveFactor`.
- Do not change WebGPU route behavior, shader behavior, browser examples,
  binary GLB loading, IBL, shadows, or non-built-in material rendering.

## Next Step

Run `task-1611` to audit this selected follow-up before implementation.
