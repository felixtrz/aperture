# Frame-Resource Route Diagnostic Helper Implementation Audit

Date: 2026-05-18

Task: `task-1628`

## Scope

Audit the `task-1627` implementation that extracted frame-resource route app
diagnostic construction from `queued-built-in-frame-resource-set.ts`.

## Findings

- Added
  `packages/webgpu/src/webgpu/queued-material-frame-resource-route-diagnostics.ts`
  with `createWebGpuAppFrameResourceRouteDiagnostic()`.
- `queued-built-in-frame-resource-set.ts` now delegates
  `createQueuedBuiltInFrameResourceRouteDiagnostic()` to that helper while
  preserving the existing built-in export name and app-facing diagnostic type.
- `packages/webgpu/src/webgpu/index.ts` exports the new helper module.
- Added targeted coverage in
  `test/webgpu/queued-material-frame-resource-route-diagnostics.test.ts` for
  the diagnostic code, message, route payload, facade queue keys, backend
  resource keys, and JSON-safe serialization.

## Boundary Check

- The implementation only changes diagnostic construction. It does not change
  queue traversal, pipeline lookup, texture/sampler dependency preparation,
  frame-resource creation, draw submission, or successful-frame diagnostics.
- `webGpuApp.frameResourceRoute` remains failure-only in the app path.
- Route shells still carry metadata only; raw GPU resource handles are not
  copied into the diagnostic payload.
- ECS authority, render extraction, WebGPU-only backend ownership, and
  JSON-safe diagnostics are preserved.
- The change does not broaden into sampler, GLB, IBL, shadow, or app-level
  non-built-in material rendering work.

## Validation

- `pnpm exec vitest run test/webgpu/queued-material-frame-resource-route-diagnostics.test.ts`
- `pnpm exec vitest run test/webgpu/queued-built-in-frame-resource-set.test.ts --testNamePattern "failed frame-resource routes"`
- `pnpm run typecheck:test`
- `pnpm run typecheck`

## Recommendation

Proceed to tracker/backlog alignment. The next planning slice should decide
whether route/prepared-resource cleanup should continue with another small
frame-resource boundary cleanup or briefly return to StandardMaterial/glTF
fidelity coverage.
