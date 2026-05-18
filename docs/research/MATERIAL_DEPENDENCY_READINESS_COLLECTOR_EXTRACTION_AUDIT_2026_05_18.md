# Material Dependency Readiness Collector Extraction Audit

Date: 2026-05-18

Task: `task-1588`

## Scope

Audit the `task-1587` implementation that moved app material dependency
readiness diagnostic collection into `app-diagnostics-summary.ts`.

## Findings

- `collectWebGpuAppMaterialDependencyReadiness()` now scans diagnostics for
  `webGpuApp.materialDependenciesNotReady` using the public
  `materialDependencyReadiness` field.
- Unknown diagnostics and malformed readiness payloads are ignored.
- `webGpuAppRenderReportToJsonValue()` now uses the shared helper while keeping
  the existing `materialDependencyReadiness` JSON field shape.
- Unit coverage proves valid extraction, empty output for missing/malformed
  diagnostics, and JSON-safe serialization.

## Boundary Check

- The change does not alter material dependency readiness policy, source asset
  lookup, route traversal, adapter selection, frame-resource preparation, or
  shader behavior.
- ECS authority and render extraction boundaries are unchanged.
- The helper works on app diagnostics and does not expose WebGPU handles.
- No binary GLB loading, IBL, shadows, or app-level non-built-in material
  rendering was introduced.

## Validation

- `pnpm exec vitest run test/webgpu/app-diagnostics-summary.test.ts`
- `pnpm run typecheck`

## Recommendation

Proceed to tracker/backlog alignment. The next planning slice should compare a
real route/prepared-resource cleanup against a remaining StandardMaterial/glTF
fidelity gap before adding another diagnostics helper.
