# App Adapter Registry Coexistence Regression Audit

Date: 2026-05-18

Task: `task-1679`

## Scope

Audit the `task-1678` implementation against the selected plan.

Reference files inspected:

- `docs/research/NEXT_APP_ADAPTER_OR_STANDARD_AFTER_FACTOR_BROWSER_PLAN_2026_05_18.md`
- `docs/research/APP_ADAPTER_REGISTRY_COHABITATION_PLAN_AUDIT_2026_05_18.md`
- `test/webgpu/queued-material-adapter-json.test.ts`
- `packages/webgpu/src/webgpu/queued-material-adapter.ts`
- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`

## Findings

- The implementation is test-only and stays within
  `test/webgpu/queued-material-adapter-json.test.ts`.
- The new regression builds a generic registry with every built-in app resource
  adapter family plus a test-only `test-preview` app-owned family key.
- Validation succeeds when the expected family list includes both built-ins and
  the app-owned family key.
- Duplicate app-owned family diagnostics remain warnings with stable
  first/duplicate indexes. The test also verifies lookup returns the registered
  app-owned family rather than implying a built-in fallback.
- JSON assertions keep the output limited to family keys and diagnostics. The
  test guards against adapter functions, raw GPU handles, public `MaterialAsset`
  source API leakage, and fallback wording.
- No ECS authority, render extraction, WebGPU-only backend ownership, public
  API, shader, pipeline, IBL, shadow, binary GLB, or app-level non-built-in
  rendering behavior changed.

## Validation

- `pnpm exec vitest run test/webgpu/queued-material-adapter-json.test.ts`
- `pnpm run typecheck`
- `pnpm run typecheck:test`

## Recommendation

Align tracker/backlog state next. A later route/app adapter slice can decide
whether to add an explicit app-owned adapter registration facade; public custom
material source authoring still requires a separate decision record.
