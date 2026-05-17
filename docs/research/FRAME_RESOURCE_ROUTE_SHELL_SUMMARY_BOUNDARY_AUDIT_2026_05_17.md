# Frame-Resource Route Shell Summary Boundary Audit

Date: 2026-05-17

Task: `task-1042`

## Scope

This audit covers the compact frame-resource route shell summary helper added to
`queued-material-frame-resource-route.ts`.

## Reference Anchors Inspected

- `packages/webgpu/src/webgpu/queued-material-frame-resource-route.ts`
- `test/webgpu/queued-material-frame-resource-route.test.ts`
- `packages/webgpu/src/webgpu/app.ts`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`

## Findings

The helper is reporting-only. It converts an existing
`QueuedMaterialFrameResourceRouteShell` into a compact summary with:

- route validity/status/family;
- booleans for facade/backend key presence;
- pipeline key, source version, and frame;
- diagnostic total and deterministic diagnostic code counts.

The summary deliberately omits facade resource keys, backend resource keys,
diagnostic messages, diagnostic resource keys, raw resources, and GPU handles.

## Boundary Check

- The helper does not change app orchestration or resource creation order.
- Successful app frames still do not emit this summary by default.
- Source asset ownership remains in ECS/asset collections and prepared facade
  stores; backend resource ownership remains in WebGPU caches.
- Failure diagnostics policy remains separate from optional compact summaries.

## Validation

- `pnpm exec vitest run test/webgpu/queued-material-frame-resource-route.test.ts`
- `pnpm exec tsc --noEmit -p packages/webgpu/tsconfig.json`

Result: passed.

## Follow-Up

The next ready task is `task-1043`, planning whether StandardMaterial sampler
fidelity warnings should feed readiness diagnostics or remain separate
inspection-only summaries for now.
