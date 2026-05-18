# Frame-Resource Route Diagnostic Helper Plan Audit

Date: 2026-05-18

Task: `task-1626`

## Scope

Audit the `task-1625` plan to extract app-facing
`webGpuApp.frameResourceRoute` diagnostic construction from
`queued-built-in-frame-resource-set.ts`.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/DECISIONS.md`
- `docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_PREPARE_ROUTE_DIAGNOSTIC_NORMALIZATION_PLAN_2026_05_18.md`
- `docs/research/FRAME_RESOURCE_ROUTE_SHELL_APP_DIAGNOSTICS_BOUNDARY_AUDIT_2026_05_17.md`
- `docs/research/GENERIC_FRAME_RESOURCE_SUCCESS_PATH_MIGRATION_PLAN_2026_05_17.md`
- `packages/webgpu/src/webgpu/queued-built-in-frame-resource-set.ts`
- `packages/webgpu/src/webgpu/queued-material-frame-resource-route.ts`
- `test/webgpu/queued-built-in-frame-resource-set.test.ts`
- `test/webgpu/queued-material-frame-resource-route.test.ts`

## Findings

- The selected follow-up is concrete enough for one focused run. It only moves
  diagnostic construction and does not require changing route traversal,
  pipeline lookup, texture/sampler dependency preparation, frame-resource
  creation, or draw submission.
- The existing `QueuedMaterialFrameResourceRouteShell` already preserves the key
  separation that matters for future route debugging: facade queue keys remain
  separate from backend source-version resource keys.
- The helper should keep the public diagnostic code and message exactly stable:
  `webGpuApp.frameResourceRoute` and
  `WebGPU app frame resource preparation failed for '<family>' material route.`
- Tests should stay focused on helper output and the existing built-in
  preparation failure path. Successful frames should continue to omit
  `webGpuApp.frameResourceRoute` diagnostics by default.

## Boundary Check

- ECS authority and render extraction are unaffected because the change is
  entirely after `RenderSnapshot` queue routing.
- WebGPU ownership remains intact because the diagnostic route shell omits raw
  GPU resources and only carries route/status metadata.
- The change does not introduce WebGL fallback, app-level non-built-in material
  rendering, GLB loading, IBL, shadows, or a public successful-frame report.
- The helper name should avoid claiming generic non-built-in app support before
  that source/material adapter contract exists.

## Recommendation

Proceed to `task-1627` as planned:

- Add `queued-material-frame-resource-route-diagnostics.ts`.
- Move the app-facing diagnostic interface and constructor into that helper.
- Keep `queued-built-in-frame-resource-set.ts` exporting/reusing the helper so
  existing imports and diagnostics remain stable.
- Add targeted tests for diagnostic shape, JSON safety, and key preservation.

## Suggested Validation

- `pnpm exec vitest run test/webgpu/queued-material-frame-resource-route-diagnostics.test.ts`
- `pnpm exec vitest run test/webgpu/queued-built-in-frame-resource-set.test.ts --testNamePattern "failed frame-resource routes"`
- `pnpm run typecheck:test`
