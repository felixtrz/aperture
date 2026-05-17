# Successful Frame Route Shell Omission Regression Audit - 2026-05-17

## Scope

Audit the test-only regression added after the generic frame-resource success
path plan.

The regression asserts that successful mixed-family app frames do not emit
`webGpuApp.frameResourceRoute` diagnostics while existing frame-resource route
shell failure diagnostics remain covered separately.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/research/GENERIC_FRAME_RESOURCE_SUCCESS_PATH_MIGRATION_PLAN_2026_05_17.md`
- `docs/research/GENERIC_FRAME_RESOURCE_SUCCESS_PATH_PLAN_BOUNDARY_AUDIT_2026_05_17.md`
- `docs/research/SUCCESSFUL_FRAME_ROUTE_SHELL_POLICY_BOUNDARY_AUDIT_2026_05_17.md`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/queued-material-frame-resource-route.ts`
- `test/webgpu/webgpu-app.test.ts`
- `test/webgpu/queued-material-frame-resource-route.test.ts`

## Findings

The regression is boundary-safe:

- It changes only app tests and adds no production behavior.
- It proves successful app frames still omit frame-resource route shell
  diagnostics by default.
- It preserves the existing failure-only route diagnostic behavior.
- It does not change resource preparation, shader selection, bind group
  creation, cache summaries, draw output, or public successful report shape.

## Follow-Up

The next implementation task can safely use this regression as a guard while
wrapping successful and failed frame-resource preparation through the generic
shell internally.

## Validation

- `pnpm exec vitest run test/webgpu/webgpu-app.test.ts --testNamePattern "routes scalar and textured StandardMaterial queue items with unlit and matcap draws"`
- `pnpm exec vitest run test/webgpu/queued-material-frame-resource-route.test.ts`
- `pnpm exec tsc --noEmit -p packages/webgpu/tsconfig.json`
