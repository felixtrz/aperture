# Generic Frame Resource Adapter Contract Boundary Audit - 2026-05-17

## Scope

Audit the generic frame-resource adapter contract types added in `task-0997`.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/research/GENERIC_FRAME_RESOURCE_ADAPTER_CONTRACT_EXTRACTION_PLAN_2026_05_17.md`
- `packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts`
- `packages/webgpu/src/webgpu/app.ts`
- `test/webgpu/built-in-material-app-resource-adapter.test.ts`
- `test/webgpu/queued-material-frame-resource-route.test.ts`

## Findings

The contract slice is boundary-safe:

- `QueuedMaterialFrameResourceAdapterResult` is a small structural result type:
  `valid`, `resources`, and `diagnostics`.
- `QueuedMaterialFrameResourceAdapterContext` is type-only scaffolding for a
  future extraction and is not wired into runtime behavior yet.
- Existing unlit, Matcap, and Standard frame-resource callbacks still run
  through the existing built-in registry.
- No successful app report shape changed.
- No route diagnostics, retained cache summaries, texture/sampler preparation,
  pipeline creation, bind group layout selection, draw submission, or resource
  reuse counters changed.
- The targeted adapter test now compiles all built-in frame callback results
  against the generic result shape.

## Architecture Check

The types live in the WebGPU package and describe WebGPU app frame-resource
adapter boundaries only. They do not move ECS/source ownership, expose raw GPU
handles, or collapse facade queue keys with backend source-version keys.

## Validation

- `pnpm exec vitest run test/webgpu/built-in-material-app-resource-adapter.test.ts`
- `pnpm exec vitest run test/webgpu/queued-material-frame-resource-route.test.ts`
- `pnpm exec tsc --noEmit -p packages/webgpu/tsconfig.json`

No corrective follow-up is required for the contract type slice.
