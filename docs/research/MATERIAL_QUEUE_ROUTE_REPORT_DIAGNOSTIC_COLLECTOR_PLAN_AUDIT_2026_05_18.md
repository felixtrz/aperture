# Material Queue Route Report Diagnostic Collector Plan Audit

Date: 2026-05-18

Task: `task-1581`

## Scope

Audit the selected follow-up from
`NEXT_ROUTE_OR_STANDARD_AFTER_OMITTED_SAMPLER_PLAN_2026_05_18.md`: extract the
private material-queue route-report diagnostic collector into a reusable helper.

## Assessment

The selected follow-up is concrete enough for one focused run:

- The existing app code already has a private collector that scans diagnostics
  for `webGpuApp.materialQueueRouteReport`.
- The extraction can live beside diagnostics summary helpers without changing
  route traversal, adapter selection, or frame-resource preparation.
- Targeted tests can cover valid reports, unknown diagnostics, malformed
  reports, and JSON-safety.

## Boundary Check

- ECS authority and render extraction remain unchanged.
- WebGPU remains the only backend.
- The helper consumes JSON-like diagnostics and does not expose raw GPU handles.
- The task should not expand into generic material-family adapter routing or a
  broad built-in collector rewrite.

## Recommendation

Proceed with `task-1582` as scoped.
