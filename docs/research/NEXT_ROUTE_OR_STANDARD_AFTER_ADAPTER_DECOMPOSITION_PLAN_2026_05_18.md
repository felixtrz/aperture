# Next Route Or Standard Follow-Up After Adapter Decomposition

Date: 2026-05-18

Task: `task-1645`

## Context

`task-1642` decomposed real non-built-in app material adapter support into
ordered slices and recommended starting with a generic app adapter contract
audit. The goal is to understand whether the current generic route/adapter
types are sufficient before adding any runtime custom material support.

## Candidates

### Route / Prepared-Resource Candidate

Audit the generic app adapter contracts for non-built-in readiness.

Pros:

- Directly follows the decomposition recommendation.
- Can stay docs/test-only and preserve closed source material asset kinds.
- Should clarify whether the next implementation can be a small type/test slice
  or whether a decision record is needed first.

Cons:

- Does not render anything.
- May identify blockers rather than code changes.

Decision: select.

### StandardMaterial / glTF Fidelity Candidate

Add metallic/roughness scalar-factor times texture browser coverage.

Pros:

- Useful PBR fidelity coverage.

Cons:

- More lighting-sensitive than the last base-color tint proof.
- The route architecture now has a concrete design audit ready to run.

Decision: defer.

### Diagnostics / Tooling Candidate

Promote the route diagnostics map into public docs.

Pros:

- Would make diagnostics easier for users to inspect.

Cons:

- The app adapter contract audit may change near-term wording and recommended
  next route slices.

Decision: defer.

## Selected Follow-Up

### task-1647 — Audit generic app adapter contract readiness

Category: `audit-refactor`
Package/write-scope:
`docs/research/GENERIC_APP_ADAPTER_CONTRACT_READINESS_AUDIT_2026_05_18.md`;
targeted type/test files only if the audit finds a tiny corrective mismatch.
Reference anchor:
this plan, `docs/ARCHITECTURE.md`, `docs/MEDIUM_LONG_TERM_GOALS.md`,
`docs/DECISIONS.md`,
`docs/research/NON_BUILT_IN_APP_MATERIAL_ADAPTER_DECOMPOSITION_2026_05_18.md`,
`packages/webgpu/src/webgpu/queued-material-adapter.ts`,
`packages/webgpu/src/webgpu/queued-material-prepare-route.ts`,
`packages/webgpu/src/webgpu/queued-material-frame-resource-set.ts`,
`packages/webgpu/src/webgpu/queued-material-app-resource-item.ts`, and
`packages/render/src/materials/types.ts`.

Acceptance criteria:

- Identify which current generic adapter/route contracts are already
  non-built-in-ready.
- Identify which boundaries remain built-in/app policy or closed source asset
  policy.
- Recommend exactly one next route/prepared-resource task or state that a
  decision record is needed first.
- Do not add runtime custom material rendering, public source material APIs,
  shader code, examples, or browser fixtures.

## Next Step

Run `task-1646` to audit this selected follow-up before implementation.
