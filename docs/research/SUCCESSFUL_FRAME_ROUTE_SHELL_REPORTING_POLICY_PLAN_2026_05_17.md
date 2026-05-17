# Successful-Frame Route Shell Reporting Policy Plan - 2026-05-17

## Goal

Decide whether `QueuedMaterialFrameResourceRouteShell` data should appear for
successful frames after `task-0978` added failure-only diagnostics.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/research/FRAME_RESOURCE_ROUTE_SHELL_APP_DIAGNOSTICS_BOUNDARY_AUDIT_2026_05_17.md`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/queued-material-frame-resource-route.ts`
- `test/webgpu/webgpu-app.test.ts`

## Decision

Keep successful-frame route shells omitted for now.

Failure diagnostics are already useful because they explain why a frame could
not prepare resources. Successful-frame shells would add another app report
surface and per-frame diagnostic data for a path that currently renders and is
already covered by `resourceReuse`, draw counts, pipeline results, and existing
targeted app tests.

## Rationale

- The current Architecture docs allow diagnostic helpers to allocate, but valid
  frame paths should avoid fresh wrappers unless a report has clear value.
- A successful-frame shell would be a new report-shape commitment. The public
  app report currently does not need route-level success details to explain
  rendered frames.
- Failure-only shells keep the key split visible exactly where it matters: when
  frame resource preparation fails.
- If future debugging needs successful route shells, they should be gated behind
  an explicit optional diagnostics/report flag rather than emitted by default.

## Follow-Up

No immediate implementation follow-up is needed for successful-frame route
shells. Keep `task-0969` as the next material fidelity planning task. If a later
debugging workflow needs successful route shells, add a scoped task for an
optional diagnostics flag with allocation and report-shape tests.
