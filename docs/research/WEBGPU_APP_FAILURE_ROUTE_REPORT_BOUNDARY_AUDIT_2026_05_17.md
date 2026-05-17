# WebGPU App Failure Route Report Boundary Audit - 2026-05-17

## Scope

Audit the failure-only wiring of material queue route reports into the WebGPU
app queued built-in route.

Audited files:

- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/material-queue-route-report.ts`
- `test/webgpu/webgpu-app.test.ts`
- `docs/research/WEBGPU_APP_MATERIAL_QUEUE_ROUTE_REPORT_INTEGRATION_PLAN_2026_05_17.md`

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/research/WEBGPU_APP_MATERIAL_QUEUE_ROUTE_REPORT_INTEGRATION_PLAN_2026_05_17.md`
- current WebGPU app queued built-in route and diagnostics tests

## Findings

No boundary drift found.

`collectQueuedBuiltInAppResourceSet` still builds queue items from the extracted
`RenderSnapshot`, resolves source mesh/material assets from the caller-owned
asset registry, and routes items through the built-in adapter registry. The
existing specific diagnostics remain the first top-level diagnostics for
unsupported families, unsupported phases/blends, and material asset mismatches.

The new `webGpuApp.materialQueueRouteReport` diagnostic is appended only when
the route is invalid. It is built from scalar queue-item summaries, routed-item
summaries, and copied diagnostic fields. The report omits adapters, source
assets, mesh draw packets, prepared resources, pipelines, bind groups, command
encoders, devices, and canvas/context objects.

The successful queued built-in path does not call the route report helper and
the focused mixed unlit/matcap/StandardMaterial test asserts that no route
report diagnostic is emitted on either first render or reuse render.

The route report helper remains WebGPU-local diagnostic metadata. It does not
import ECS, source assets, render snapshots, asset registries, GPU resources, or
browser globals. App routing remains derived from extracted render data; no
scene graph, renderer-owned ECS/game state, or WebGL fallback was introduced.

## Validation

- `pnpm exec vitest run test/webgpu/webgpu-app.test.ts --testNamePattern "routes scalar and textured StandardMaterial queue items with unlit and matcap draws|unsupported material queue families|unsupported alpha-test material queue families|unsupported transparent material queue families"`
- `pnpm exec vitest run test/webgpu/material-queue-route-report.test.ts test/webgpu/material-queue-route-report-json.test.ts test/webgpu/material-queue-route-report-diagnostics.test.ts`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm run check:boundaries`

## Follow-Ups

- Plan a reusable route report shell before adding success-path route summaries
  to app frame reports.
- Tighten route report JSON helper optional-field behavior in a focused slice
  before expanding the report surface.
