# Material Queue Route Report Diagnostic Collector Implementation Audit

Date: 2026-05-18

Task: `task-1583`

## Scope

Audit the `task-1582` implementation that extracted material queue route report
diagnostic collection from `app.ts` into `app-diagnostics-summary.ts`.

## Findings

- `collectWebGpuAppMaterialQueueRouteReport()` now scans diagnostics for
  `webGpuApp.materialQueueRouteReport` using the public `report` field.
- Unknown diagnostics and malformed reports are ignored and return `null`.
- The app route-failure diagnostics summary now calls the reusable helper
  instead of a private local collector.
- Unit coverage proves valid extraction, missing/malformed diagnostics, and
  JSON-safe report serialization.

## Boundary Check

- The change does not alter route traversal, adapter selection, material-family
  policy, or frame-resource preparation.
- ECS authority and render extraction boundaries are unchanged.
- The helper works on JSON-like diagnostics and does not expose WebGPU handles.
- The extraction is a narrow route-diagnostics cleanup, not a broad collector
  rewrite.

## Validation

- `pnpm exec vitest run test/webgpu/app-diagnostics-summary.test.ts`
- `pnpm run typecheck`

## Recommendation

Proceed to tracker/backlog alignment. The next planning slice can choose either
another small route helper or one remaining StandardMaterial/glTF fidelity gap.
