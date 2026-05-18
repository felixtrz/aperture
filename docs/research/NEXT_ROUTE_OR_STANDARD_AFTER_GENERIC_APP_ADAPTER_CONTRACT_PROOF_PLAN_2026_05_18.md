# Next Route Or Standard Follow-Up After Generic App Adapter Contract Proof

Date: 2026-05-18

Task: `task-1653`

## Context

`task-1650` proved that a non-public test material family can pass through the
generic adapter registry, prepare-route helper, app resource item, and
frame-resource-set contracts. The remaining risk is app-level registration
policy: the WebGPU app still wires a singleton built-in adapter registry and
built-in frame-resource caches.

## Candidates

### Route / Prepared-Resource Candidate

Audit generic app adapter registration policy.

Pros:

- Directly follows the generic contract proof.
- Can classify which built-in adapter registry pieces are reusable and which
  remain built-in validation policy.
- Avoids exposing public custom material source authoring before Decision 0010
  has a follow-up.

Cons:

- Design/audit-only unless a tiny mismatch is found.
- Does not render new pixels.

Decision: select.

### StandardMaterial / glTF Fidelity Candidate

Add metallic/roughness scalar-factor times texture browser coverage.

Pros:

- Useful PBR fidelity coverage and browser-verifiable.

Cons:

- The route architecture just found a concrete next boundary risk.
- This can wait until app adapter policy is less ambiguous.

Decision: defer.

### Diagnostics / Tooling Candidate

Promote material route diagnostics map into public docs.

Pros:

- Would make diagnostic layers easier for users to inspect.

Cons:

- The app adapter registration audit may change the near-term wording around
  generic versus built-in route policy.

Decision: defer.

## Selected Follow-Up

### task-1655 — Audit generic app adapter registration policy

Category: `audit-refactor`
Package/write-scope:
`docs/research/GENERIC_APP_ADAPTER_REGISTRATION_POLICY_AUDIT_2026_05_18.md`;
targeted tests only if a tiny corrective mismatch is found.
Reference anchor:
this plan,
`docs/research/GENERIC_APP_ADAPTER_CONTRACT_PROOF_IMPLEMENTATION_AUDIT_2026_05_18.md`,
`docs/research/NON_BUILT_IN_APP_MATERIAL_ADAPTER_DECOMPOSITION_2026_05_18.md`,
`docs/ARCHITECTURE.md`, `docs/DECISIONS.md`,
`packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts`,
`packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`,
`packages/webgpu/src/webgpu/queued-built-in-frame-resource-set.ts`, and
`packages/webgpu/src/webgpu/app.ts`.

Acceptance criteria:

- Identify which app adapter registration pieces can become generic without
  exposing public custom source material authoring.
- Identify which validation diagnostics remain built-in-specific and which
  should become generic app adapter policy.
- Recommend exactly one implementation slice or state that a decision record is
  required first.
- Do not add public custom material source APIs, shader code, GPU resources,
  examples, or browser fixtures.

## Next Step

Run `task-1654` to audit this selected follow-up plan before implementation.
