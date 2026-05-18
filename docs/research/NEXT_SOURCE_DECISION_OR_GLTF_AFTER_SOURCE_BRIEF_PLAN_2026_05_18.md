# Next Source Decision Or glTF Follow-Up After Source Brief

Date: 2026-05-18

Task: `task-1701`

## Context

The custom material source/API design brief lists the questions that must be
answered before public custom material source assets or app-owned adapter
facades can be accepted. The next slice should convert one narrow part of that
brief into a decision-ready artifact, not implement public custom materials.

## Candidates

### Public Custom Material Source Decision Candidate

Draft a decision-ready checklist for the minimum public custom material source
asset shape.

Pros:

- Directly follows the design brief without committing to implementation.
- Helps a future decision record stay narrow by separating source asset shape
  from shader/resource implementation.
- Keeps public custom material support gated behind docs and review.

Cons:

- Still docs-only.

Decision: select.

### Diagnostics Example / Tooling Candidate

Add an example status fixture for the material route diagnostics docs.

Pros:

- Would make route diagnostics easier to inspect manually.

Cons:

- The source/API decision path is the current blocker after Decision 0011 and
  the design brief.

Decision: defer.

### StandardMaterial / glTF Fidelity Candidate

Return to browser-visible StandardMaterial/glTF fidelity, such as texture
transform rotation.

Pros:

- Adds visible rendering confidence.

Cons:

- It is a larger browser implementation slice and should wait for the next run
  unless selected with enough time.

Decision: defer.

## Selected Follow-Up

### task-1703 — Draft source asset shape decision checklist

Category: `docs-tooling`
Package/write-scope:
`docs/research`; backlog/handoff docs only for alignment.
Reference anchor:
this plan,
`docs/research/CUSTOM_MATERIAL_SOURCE_API_DESIGN_BRIEF_2026_05_18.md`,
`docs/DECISIONS.md` Decision 0011,
`docs/ARCHITECTURE.md`, and `docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Draft a decision-ready checklist for the minimum public custom material source
  asset shape.
- Separate source asset shape decisions from validation, dependency,
  preparation, shader/resource, and app facade implementation tasks.
- Keep it non-binding and do not add public custom material source APIs,
  app-owned adapter facades, app-level non-built-in rendering, IBL, shadows, or
  binary GLB loading.

## Next Step

Run `task-1702` to audit this selected follow-up plan before implementation.
