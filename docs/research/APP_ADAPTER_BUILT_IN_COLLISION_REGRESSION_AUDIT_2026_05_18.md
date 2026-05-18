# App Adapter Built-In Collision Regression Audit

Date: 2026-05-18

Task: `task-1684`

## Scope

Audit the `task-1683` implementation against the selected collision-policy
plan.

Reference files inspected:

- `docs/research/NEXT_APP_ADAPTER_OR_STANDARD_AFTER_REGISTRY_COHABITATION_PLAN_2026_05_18.md`
- `docs/research/APP_ADAPTER_BUILT_IN_COLLISION_PLAN_AUDIT_2026_05_18.md`
- `test/webgpu/queued-material-adapter-json.test.ts`
- `packages/webgpu/src/webgpu/queued-material-adapter.ts`
- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`

## Findings

- The implementation is test-only and stays inside
  `test/webgpu/queued-material-adapter-json.test.ts`.
- The new regression registers all built-in app resource families first, then a
  colliding app-owned-style `standard` adapter.
- The test asserts `get("standard")` returns the first built-in-style
  registration rather than the colliding app-owned adapter.
- Duplicate diagnostics remain warnings with stable first/duplicate indexes,
  and the validation report remains valid when all required built-in families
  are present.
- JSON assertions confirm adapter labels/functions and raw GPU/public source
  concepts do not leak into the report. The output also avoids override or
  fallback wording.
- No ECS authority, render extraction, WebGPU-only backend ownership, public
  API, shader, pipeline, IBL, shadow, binary GLB, or app-level non-built-in
  rendering behavior changed.

## Validation

- `pnpm exec vitest run test/webgpu/queued-material-adapter-json.test.ts`
- `pnpm run typecheck`
- `pnpm run typecheck:test`

## Recommendation

Align tracker/backlog state next. The next planning task can decide between an
explicit app-owned adapter facade shape, another StandardMaterial/glTF fidelity
slice, or stabilizing the route diagnostics documentation.
