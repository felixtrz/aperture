# Scalar Standard Route Summary Field Shape Plan Audit

Date: 2026-05-18

Task: `task-1596`

## Scope

Audit the `task-1595` plan to add an app-level scalar StandardMaterial route
regression for diagnostics summary field shape.

## Findings

- The selected follow-up is concrete enough for one focused run.
- The existing scalar StandardMaterial app route test already builds a full
  successful app report with `routedResourceSet`.
- Adding explicit absence checks for `standardResourceSet`, `unlitResourceSet`,
  and `matcapResourceSet` pins the app-level public route-report shape without
  changing runtime behavior.
- This is a route/prepared-resource contract regression, not a shader, browser,
  or new material-family task.

## Boundary Check

- ECS authority and render extraction boundaries are unchanged.
- WebGPU ownership is unchanged; the test only inspects JSON-safe app report
  output.
- No route traversal, prepared-resource lifetime, StandardMaterial shader,
  binary GLB loading, IBL, shadows, or app-level non-built-in rendering changes
  are required.

## Recommendation

Proceed to `task-1597` as a targeted `test/webgpu/webgpu-app.test.ts` change.
