# WebGPU Route Report Shell Boundary Audit - 2026-05-17

## Scope

Audit the reusable material queue route report shell and the WebGPU app
failure-only projection that now uses it.

Audited files:

- `packages/webgpu/src/webgpu/material-queue-route-report.ts`
- `packages/webgpu/src/webgpu/app.ts`
- `test/webgpu/material-queue-route-report-shell.test.ts`
- `test/webgpu/webgpu-app.test.ts`

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/research/WEBGPU_MATERIAL_QUEUE_ROUTE_REPORT_SHELL_PLAN_2026_05_17.md`
- route report shell tests and current queued built-in app route

## Findings

No boundary drift found.

The route report shell is mutable WebGPU-local scratch. It stores scalar counts,
bucket maps, copied diagnostics, a diagnostic summary, and a routed-key set. It
does not store ECS world state, asset registries, `RenderSnapshot`, source
assets, adapters, mesh draw packets, prepared GPU resources, pipelines, bind
groups, devices, command encoders, or browser objects.

JSON projection remains the explicit allocation boundary. The shell writer can
reuse the same shell object, maps, diagnostics array, summary object, and routed
key set across writes; tests verify reuse and key cleanup.

`collectQueuedBuiltInAppResourceSet` now owns one route report shell through
`QueuedBuiltInAppRouteScratch`. The app uses it only when the queued built-in
route is invalid. Successful queued unlit, matcap, and StandardMaterial renders
still do not emit `webGpuApp.materialQueueRouteReport` diagnostics by default.

Existing specific route diagnostics remain top-level diagnostics. The aggregate
report diagnostic is appended after those specific diagnostics and contains only
JSON-safe route metadata.

## Validation

- `pnpm exec vitest run test/webgpu/material-queue-route-report.test.ts test/webgpu/material-queue-route-report-json.test.ts test/webgpu/material-queue-route-report-diagnostics.test.ts test/webgpu/material-queue-route-report-shell.test.ts`
- `pnpm exec vitest run test/webgpu/material-queue-route-report-shell.test.ts test/webgpu/webgpu-app.test.ts --testNamePattern "material queue route report shell|routes scalar and textured StandardMaterial queue items with unlit and matcap draws|unsupported material queue families|unsupported alpha-test material queue families|unsupported transparent material queue families"`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm run check:boundaries`

## Follow-Ups

- Plan built-in adapter registry factory extraction before moving more route
  behavior out of `app.ts`.
- Add asset-mismatch route report coverage so every specific route diagnostic
  family is represented in aggregate report tests.
