# Material Dependency Readiness Collector Plan Audit

Date: 2026-05-18

Task: `task-1586`

## Scope

Audit the `task-1585` plan to extract the app material dependency readiness
collector from `app.ts` into `app-diagnostics-summary.ts`.

## Findings

- The selected follow-up is concrete enough for one focused run: it moves one
  diagnostic scanning helper and adds direct unit coverage.
- The public diagnostic contract already exists:
  `webGpuApp.materialDependenciesNotReady` carries a
  `materialDependencyReadiness` object.
- The helper can operate on `readonly unknown[]` diagnostics, matching the
  existing route-report collector shape.
- `webGpuAppRenderReportToJsonValue()` can call the helper without changing the
  public JSON field name or serialized payload shape.

## Boundary Check

- ECS authority is unchanged; the helper reads app diagnostics after extraction
  and resource preparation have already produced a report.
- Render extraction boundaries are unchanged; no ECS queries, source assets, or
  render snapshots are modified.
- WebGPU ownership is unchanged; the helper must not expose or inspect raw GPU
  objects.
- Dependency readiness policy remains in the existing readiness/report builders.
  The extraction only centralizes collection from diagnostics.

## Recommendation

Proceed to `task-1587` as planned.

Keep the implementation limited to:

- `app-diagnostics-summary.ts`;
- `app.ts`;
- focused `app-diagnostics-summary` tests.

Do not expand the task into route traversal, prepared-resource behavior,
StandardMaterial shader behavior, binary GLB loading, IBL, shadows, or
app-level non-built-in material rendering.
