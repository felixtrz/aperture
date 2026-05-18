# Source Asset Shape Checklist Plan Audit

Date: 2026-05-18

Task: `task-1702`

## Scope

Audit the `task-1701` selected follow-up before implementation.

Reference files inspected:

- `docs/research/NEXT_SOURCE_DECISION_OR_GLTF_AFTER_SOURCE_BRIEF_PLAN_2026_05_18.md`
- `docs/research/CUSTOM_MATERIAL_SOURCE_API_DESIGN_BRIEF_2026_05_18.md`
- `docs/DECISIONS.md` Decision 0011
- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`

## Findings

- The selected follow-up is concrete and docs-only.
- A decision-ready checklist is a safe next step because it does not accept or
  implement a public custom material source API.
- The checklist should isolate source asset shape decisions from validation,
  dependency declaration, preparation/lifetime, shader/resource contracts, and
  app facade registration.
- The task should not touch runtime code, app facade options, examples,
  browser tests, shaders, or package exports.

## Recommendation

Implement `task-1703` as selected if there is still time before wrap-up.
