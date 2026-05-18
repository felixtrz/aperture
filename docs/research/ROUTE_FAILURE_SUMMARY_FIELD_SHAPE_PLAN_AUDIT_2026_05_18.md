# Route Failure Summary Field Shape Plan Audit

Date: 2026-05-18

Task: `task-1601`

## Scope

Audit the `task-1600` plan to pin route-failure diagnostics summary field shape.

## Findings

- The selected follow-up is concrete enough for one focused run.
- The unsupported material queue family app route test already produces a route
  failure report with `materialQueueRoute`.
- Adding explicit absence checks for built-in family-specific resource-set
  fields complements the successful-route assertion from `task-1597`.

## Boundary Check

- ECS authority and render extraction boundaries are unchanged.
- The implementation is test-only and inspects JSON-safe app report output.
- No route traversal, prepared-resource behavior, shader behavior, binary GLB
  loading, IBL, shadows, or non-built-in rendering changes are required.

## Recommendation

Proceed to `task-1602` in `test/webgpu/webgpu-app.test.ts`.
