# Custom Material Source API Design Brief Audit

Date: 2026-05-18

Task: `task-1699`

## Scope

Audit the `task-1698` design brief.

Reference files inspected:

- `docs/research/NEXT_SOURCE_API_OR_GLTF_AFTER_DECISION_0011_PLAN_2026_05_18.md`
- `docs/research/CUSTOM_MATERIAL_SOURCE_API_DESIGN_PLAN_AUDIT_2026_05_18.md`
- `docs/research/CUSTOM_MATERIAL_SOURCE_API_DESIGN_BRIEF_2026_05_18.md`
- `docs/DECISIONS.md`
- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`

## Findings

- Added a non-binding custom material source/API design brief under
  `docs/research`.
- The brief lists minimum questions for source asset shape, validation,
  dependency declaration, preparation/lifetime, shader/bind group/pipeline
  contracts, diagnostics/JSON surfaces, and worker-boundary compatibility.
- It separates decisions needed before implementation from later implementation
  tasks.
- It explicitly avoids accepting a public API or adding runtime behavior.
- No runtime code, app facade option, shader, pipeline, example, browser test,
  public custom material source API, app-level non-built-in rendering, IBL,
  shadows, or binary GLB loading changed.

## Validation

- `pnpm run format:check`
- `git diff --check`

## Recommendation

Align tracker/backlog state next. The next run can decide whether to turn the
brief into a formal source asset decision, return to StandardMaterial/glTF
fidelity, or add a diagnostics example.
