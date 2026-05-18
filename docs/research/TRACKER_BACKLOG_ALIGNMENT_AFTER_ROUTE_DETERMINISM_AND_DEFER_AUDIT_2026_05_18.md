# Tracker Backlog Alignment After Route Determinism And Defer Audit

Date: 2026-05-18

## Scope

Audit tracker and backlog alignment after route migration readiness planning,
route migration deferral, and selection of the next StandardMaterial/glTF
diagnostic.

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/ARCHITECTURE.md`
- `docs/index.html`
- `docs/render-pipeline-comparison.html`
- `agent/BACKLOG.md`
- `docs/research/ROUTE_MIGRATION_READINESS_OR_GLTF_FIDELITY_AFTER_ROUTE_DETERMINISM_PLAN_2026_05_18.md`
- `docs/research/ROUTE_MIGRATION_READINESS_OR_GLTF_FIDELITY_AFTER_ROUTE_DETERMINISM_PLAN_AUDIT_2026_05_18.md`
- `docs/research/MATERIAL_ROUTE_MIGRATION_READINESS_AFTER_ROUTE_DETERMINISM_AUDIT_2026_05_18.md`
- `docs/research/NEXT_STANDARD_GLTF_FIDELITY_DIAGNOSTIC_AFTER_ROUTE_DEFER_PLAN_2026_05_18.md`

## Findings

Pass after tracker and backlog updates.

The public tracker now reflects that route-summary determinism is pinned, but
real app-level non-built-in material routing remains deferred until
material-family extensibility is planned across source materials, material queue
families, pipeline keys, prepared-resource adapters, and app diagnostics.

The render pipeline comparison keeps six phase-status entries and now lists the
selected invalid glTF sampler-index browser diagnostic as the next collect/path
fidelity follow-up. It also keeps real app-level non-built-in material adapter
routing listed as missing rather than implying route-summary unit coverage makes
that behavior active.

The ready backlog should now start with `task-1287`, the invalid glTF
sampler-index browser diagnostic, followed by an audit and enough concrete
follow-ups to keep the ready queue above five tasks after completed planning
items move to `agent/COMPLETED.md`.

## Recommendation

Implement `task-1287` next.

Keep deferred:

- app-level non-built-in material adapter routing;
- material-family extensibility implementation;
- IBL, shadows, binary GLB loading, and GLB viewer behavior;
- broad PBR rewrites.

## Validation

- `pnpm run check:progress`
