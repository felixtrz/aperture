# Tracker Backlog Alignment After Sampler Diagnostic Audit

Date: 2026-05-18

## Scope

Audit tracker and backlog alignment after the invalid sampler-index browser
fixture, sampler diagnostic audit, next sampler diagnostic plan, and
material-family extensibility boundary audit.

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/ARCHITECTURE.md`
- `docs/index.html`
- `docs/render-pipeline-comparison.html`
- `agent/BACKLOG.md`
- `docs/research/INVALID_GLTF_SAMPLER_INDEX_BROWSER_DIAGNOSTIC_AUDIT_2026_05_18.md`
- `docs/research/NEXT_GLTF_SAMPLER_OR_OPTIONAL_EXTENSION_DIAGNOSTIC_PLAN_2026_05_18.md`
- `docs/research/MATERIAL_FAMILY_EXTENSIBILITY_BOUNDARY_BEFORE_ROUTE_MIGRATION_AUDIT_2026_05_18.md`

## Findings

Pass after tracker and backlog updates.

The public tracker now records the invalid sampler-index browser fixture and
keeps app-level non-built-in material routing deferred. The next focus is an
invalid glTF sampler enum browser diagnostic, with a separate route-planning
task queued for material-family extensibility.

The render pipeline comparison keeps six phase-status entries and continues to
list real app-level non-built-in material adapter routing as missing until
material-family extensibility is planned.

The ready backlog is refilled with concrete categorized tasks:

- `task-1292` — add invalid glTF sampler enum browser diagnostic.
- `task-1293` — audit invalid glTF sampler enum browser diagnostic.
- `task-1294` — plan material-family extensibility contract.
- `task-1295` — plan optional glTF material-extension warning status.
- `task-1296` — audit tracker/backlog alignment after sampler enum diagnostic.

Each ready task includes package/write-scope, reference anchors, and acceptance
criteria.

## Recommendation

Implement `task-1292` next.

Keep deferred:

- app-level non-built-in material adapter routing;
- IBL, shadows, binary GLB loading, and GLB viewer behavior;
- public material-family plugin APIs until the extensibility contract is
  planned.

## Validation

- `pnpm run check:progress`
