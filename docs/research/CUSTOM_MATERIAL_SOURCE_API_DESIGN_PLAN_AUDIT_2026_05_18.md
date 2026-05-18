# Custom Material Source API Design Plan Audit

Date: 2026-05-18

Task: `task-1697`

## Scope

Audit the `task-1696` selected follow-up before implementation.

Reference files inspected:

- `docs/research/NEXT_SOURCE_API_OR_GLTF_AFTER_DECISION_0011_PLAN_2026_05_18.md`
- `docs/DECISIONS.md` Decision 0011
- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/DIAGNOSTICS_SUMMARIES.md`
- `docs/research/NON_BUILT_IN_APP_MATERIAL_ADAPTER_DECOMPOSITION_2026_05_18.md`

## Findings

- The selected follow-up is concrete and docs-only.
- A non-binding design brief is the right next step after Decision 0011 because
  it can separate source/API decisions from later implementation tasks.
- The brief should not become an accepted architecture decision by itself. Any
  public custom material source API still needs a later decision record before
  implementation.
- The task should not touch runtime code, app facade options, shaders,
  pipelines, examples, browser tests, or source material APIs.

## Recommendation

Implement `task-1698` as selected by adding a focused design brief under
`docs/research`.
