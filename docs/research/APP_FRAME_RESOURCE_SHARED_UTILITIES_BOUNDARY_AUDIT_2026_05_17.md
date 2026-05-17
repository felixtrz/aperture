# App Frame Resource Shared Utilities Boundary Audit - 2026-05-17

## Scope

Audit the shared app frame-resource utility extraction.

This audit covers:

- `packages/webgpu/src/webgpu/app-frame-resource-utils.ts`
- usage from unlit, Matcap, and Standard app frame-resource helpers

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/research/APP_FRAME_RESOURCE_SHARED_UTILITIES_PLAN_2026_05_17.md`
- `packages/webgpu/src/webgpu/app-frame-resource-utils.ts`
- `packages/webgpu/src/webgpu/unlit-app-frame-resources.ts`
- `packages/webgpu/src/webgpu/matcap-app-frame-resources.ts`
- `packages/webgpu/src/webgpu/standard-app-frame-resources.ts`

## Findings

No boundary drift was found.

The shared utility module contains only:

- `sameStringList`;
- `writeBufferData`;
- the small WebGPU-like queue write interface needed by `writeBufferData`.

It does not import material assets, frame resources, `WebGpuApp`, render
snapshots, app caches, layout types, render frame planning, command submission,
browser globals, ECS APIs, or module-global state.

The helper is intentionally not exported through the package public index. It is
an internal mechanical utility for the extracted app frame-resource helpers.

## Validation

- `pnpm exec vitest run test/webgpu/webgpu-app.test.ts`
- `pnpm exec tsc --noEmit -p packages/webgpu/tsconfig.json`
- `pnpm run check:boundaries`

## Follow-Ups

- Keep descriptor-plan allocation cleanup separate from this utility cleanup.
- Add focused cache-slot tests only if future changes make the broad app reuse
  tests insufficient for diagnosing cache regressions.
