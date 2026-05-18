# Custom Material Source Asset Shape Checklist Audit

Date: 2026-05-18

Task: `task-1704`

## Scope

Audit the `task-1703` checklist implementation.

Reference files inspected:

- `docs/research/NEXT_SOURCE_DECISION_OR_GLTF_AFTER_SOURCE_BRIEF_PLAN_2026_05_18.md`
- `docs/research/SOURCE_ASSET_SHAPE_CHECKLIST_PLAN_AUDIT_2026_05_18.md`
- `docs/research/CUSTOM_MATERIAL_SOURCE_ASSET_SHAPE_CHECKLIST_2026_05_18.md`
- `docs/DECISIONS.md`
- `docs/ARCHITECTURE.md`

## Findings

- Added a non-binding checklist for a future custom material source asset shape
  decision.
- The checklist separates source shape decisions from validation,
  dependencies, preparation/lifetime, shader/resource implementation, app
  facade registration, and browser rendering proof.
- It preserves the architecture constraints: source assets stay
  renderer-independent, ECS remains authoritative, WebGPU resources stay
  renderer-owned, and unsupported/colliding family keys must diagnose rather
  than override or fallback.
- No runtime code, public API, app facade option, shader, pipeline, example,
  browser test, public custom material source API, app-level non-built-in
  rendering, IBL, shadows, or binary GLB loading changed.

## Validation

- `pnpm run format:check`
- `git diff --check`

## Recommendation

Align tracker/backlog state and wrap up unless there is still meaningful time
before the hourly stop-hook window.
