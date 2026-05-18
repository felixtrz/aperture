# Next App Adapter Decision After Route Docs Plan

Date: 2026-05-18

Task: `task-1691`

## Context

The adapter registry now has coexistence and collision-policy guards, and the
public diagnostics docs explain material route diagnostic layers. The remaining
risk is public API shape: adding an app-owned adapter facade before custom
material source assets are designed would imply support that the source asset,
dependency, preparation, shader, and lifecycle contracts do not yet provide.

## Candidates

### App-Owned Adapter Source/API Decision Candidate

Add a decision record that public app-owned material adapter registration stays
deferred until Aperture defines a public custom material source asset contract.

Pros:

- Locks the boundary before implementation pressure creates an accidental
  public custom material API.
- Complements Decision 0010 with a more explicit app facade consequence.
- Keeps current generic route tests useful without overstating render support.

Cons:

- It is a docs/architecture task, not new runtime behavior.

Decision: select.

### StandardMaterial / glTF Fidelity Candidate

Add another browser fixture for a remaining StandardMaterial/glTF behavior such
as texture-transform rotation or color-space status.

Pros:

- Continues visible material fidelity work.

Cons:

- The public app adapter/API boundary should be clarified first now that route
  policy guards and diagnostics docs are in place.

Decision: defer.

### Diagnostics / Tooling Candidate

Add an example status fixture that emits the newly documented route diagnostics
surfaces.

Pros:

- Would make the docs easier to test against examples.

Cons:

- The existing app and browser diagnostics already exercise these surfaces; the
  more important next step is the public API decision.

Decision: defer.

## Selected Follow-Up

### task-1693 — Record app-owned material adapter facade decision

Category: `docs-tooling`
Package/write-scope:
`docs/DECISIONS.md`; backlog/handoff docs only for alignment.
Reference anchor:
this plan, `docs/DECISIONS.md` Decision 0010,
`docs/ARCHITECTURE.md`, `docs/MEDIUM_LONG_TERM_GOALS.md`,
`docs/DIAGNOSTICS_SUMMARIES.md`, and
`docs/research/NON_BUILT_IN_APP_MATERIAL_ADAPTER_DECOMPOSITION_2026_05_18.md`.

Acceptance criteria:

- Add a decision record stating that public app-owned material adapter facade
  options remain deferred until a public custom material source asset contract
  is accepted.
- Clarify that generic route/adapter family keys are internal or test surfaces
  unless backed by source validation, dependency, preparation, shader/resource,
  diagnostics, and lifecycle contracts.
- Preserve built-in app route behavior and do not add implementation,
  app-level non-built-in rendering, IBL, shadows, binary GLB loading, or public
  custom material source APIs.

## Next Step

Run `task-1692` to audit this selected follow-up plan before implementation.
