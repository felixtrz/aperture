# Material Route Diagnostics Map Plan Audit

Date: 2026-05-18

Task: `task-1636`

## Scope

Audit the `task-1635` plan to write a concise map of current material route
diagnostic layers.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/DECISIONS.md`
- `docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_BASE_COLOR_FACTOR_TINT_PLAN_2026_05_18.md`
- `packages/webgpu/src/webgpu/material-queue-route-report.ts`
- `packages/webgpu/src/webgpu/queued-material-prepare-route.ts`
- `packages/webgpu/src/webgpu/queued-material-prepare-route-diagnostics.ts`
- `packages/webgpu/src/webgpu/queued-material-frame-resource-route.ts`
- `packages/webgpu/src/webgpu/queued-material-frame-resource-route-diagnostics.ts`
- `packages/webgpu/src/webgpu/app-diagnostics-summary.ts`

## Findings

- The selected documentation task is concrete and small enough for one focused
  slice.
- It is useful now because recent helper extractions split diagnostics across
  route-report, prepare-route, frame-resource, app diagnostics, and summary
  collection modules.
- The map can preserve architecture boundaries by documenting ownership rather
  than introducing a new public API or runtime behavior.
- The selected task should explicitly distinguish generic route infrastructure
  from built-in/app compatibility policy so future route cleanup does not
  accidentally imply custom material rendering support.

## Boundary Check

- ECS authority, render extraction, WebGPU backend ownership, and JSON-safe
  diagnostics are unaffected.
- The task does not require code, app examples, browser fixtures, dependencies,
  or package-boundary changes.
- It should not become a new decision record because no new architectural
  decision is being made.

## Recommendation

Proceed to `task-1637`. Keep the map concise, focused on current modules and
next cleanup candidates, and avoid broad custom material design.
