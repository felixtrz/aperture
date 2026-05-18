# Next Source API Or glTF Follow-Up After Decision 0011

Date: 2026-05-18

Task: `task-1696`

## Context

Decision 0011 now blocks public app-owned material adapter facades until a
public custom material source asset contract is accepted. The next useful step
is to define the small source/API design questions that must be answered before
any implementation.

## Candidates

### Custom Material Source/API Design Candidate

Write a focused design brief for the minimum public custom material source asset
contract.

Pros:

- Directly follows Decision 0011.
- Lets future agents design source validation, dependency declaration,
  preparation, shader/resource contracts, diagnostics, and lifecycle before
  adding app facade code.
- Keeps the work docs-only and avoids premature rendering claims.

Cons:

- It does not add runtime behavior.

Decision: select.

### Diagnostics Example / Tooling Candidate

Add an example that surfaces the newly documented route diagnostics layers.

Pros:

- Makes route diagnostics easier to inspect manually.

Cons:

- The current blocker is source/API design, not missing example output.

Decision: defer.

### StandardMaterial / glTF Fidelity Candidate

Add another browser fixture for remaining glTF material fidelity such as
texture-transform rotation or color-space status.

Pros:

- Continues visible material fidelity.

Cons:

- It should wait until the new app adapter/source design track has a first
  design artifact after Decision 0011.

Decision: defer.

## Selected Follow-Up

### task-1698 — Draft custom material source API design brief

Category: `docs-tooling`
Package/write-scope:
`docs/research`; backlog/handoff docs only for alignment.
Reference anchor:
this plan, `docs/DECISIONS.md` Decision 0011,
`docs/ARCHITECTURE.md`, `docs/MEDIUM_LONG_TERM_GOALS.md`,
`docs/DIAGNOSTICS_SUMMARIES.md`, and
`docs/research/NON_BUILT_IN_APP_MATERIAL_ADAPTER_DECOMPOSITION_2026_05_18.md`.

Acceptance criteria:

- Draft a concise design brief listing the minimum source asset shape,
  validation, dependency declaration, preparation/lifetime, shader/resource,
  diagnostics, and worker-boundary questions for public custom material support.
- Identify which parts are decisions versus implementation tasks.
- Keep it non-binding and explicitly avoid implementing public source APIs,
  app-owned adapter facades, app-level non-built-in rendering, IBL, shadows, or
  binary GLB loading.

## Next Step

Run `task-1697` to audit this selected follow-up plan before implementation.
