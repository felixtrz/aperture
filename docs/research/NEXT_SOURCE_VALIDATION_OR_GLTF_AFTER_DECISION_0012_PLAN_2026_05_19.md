# Next Source Validation Or glTF Follow-Up After Decision 0012

Date: 2026-05-19

Task: `task-1711`

## Context

Decision 0012 now accepts the policy-level shape for future public custom
material source assets: data-only registered-family instances with JSON-safe
render-state, pipeline-key, binding, dependency, and metadata fields. It also
requires source validation diagnostics to stay separate from route, dependency,
preparation, frame-resource, and pipeline diagnostics.

Reference files inspected:

- `docs/DECISIONS.md` Decision 0012
- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/DIAGNOSTICS_SUMMARIES.md`
- `docs/research/CUSTOM_MATERIAL_SOURCE_SHAPE_DECISION_IMPLEMENTATION_AUDIT_2026_05_19.md`
- `packages/render/src/materials/types.ts`
- current material/glTF diagnostic tests under `test/materials` and `test/webgpu`

## Candidates

### Source Validation Diagnostics Candidate

Draft a source validation diagnostics taxonomy for Decision 0012 custom material
source assets.

Pros:

- Directly follows the new decision without implementing public custom material
  APIs.
- Separates source-shape validation errors from route/preparation failures
  before code is added.
- Gives later tests stable candidate diagnostic codes, fields, and JSON-safety
  rules.
- Keeps public app-owned adapter facades and rendered custom families deferred.

Cons:

- Still docs-only; runtime validators come later.

Decision: select.

### StandardMaterial / glTF Fidelity Candidate

Add another browser-visible StandardMaterial/glTF fidelity proof, such as a
remaining texture-transform or alpha/render-state edge case.

Pros:

- Continues useful visible PBR fidelity coverage.
- Stays on the near-term proof path.

Cons:

- It does not advance the newly accepted Decision 0012 source validation gate.
- The next custom-material task should define validation boundaries before more
  route/app work accumulates around the new decision.

Decision: defer.

### Diagnostics / Tooling Candidate

Promote Decision 0012 into `docs/DIAGNOSTICS_SUMMARIES.md` immediately.

Pros:

- Would make the public diagnostics page aware of source validation boundaries.

Cons:

- The diagnostics page should reference a clearer source validation taxonomy
  rather than only the high-level decision text.

Decision: defer until after the taxonomy.

## Selected Follow-Up

### task-1713 — Draft custom material source validation diagnostics taxonomy

Category: `docs-tooling`
Package/write-scope:
`docs/research`; backlog/handoff docs only for run bookkeeping.
Reference anchor:
this plan, `docs/DECISIONS.md` Decision 0012,
`docs/DIAGNOSTICS_SUMMARIES.md`,
`docs/research/CUSTOM_MATERIAL_SOURCE_ASSET_SHAPE_CHECKLIST_2026_05_18.md`,
`packages/render/src/materials/types.ts`, and current material/glTF diagnostic
tests.

Acceptance criteria:

- Draft a concise taxonomy for future custom material source validation
  diagnostics, including candidate code families, severity, stable fields, and
  JSON-safe payload limits.
- Explicitly separate source validation diagnostics from route, dependency,
  preparation, frame-resource, pipeline, and app-owned adapter facade
  diagnostics.
- Keep the taxonomy non-binding and do not add public custom material source
  APIs, validators, app facade options, rendered custom families, IBL, shadows,
  or binary GLB loading.

## Next Step

Run `task-1712` to audit this selected follow-up plan before implementation.
