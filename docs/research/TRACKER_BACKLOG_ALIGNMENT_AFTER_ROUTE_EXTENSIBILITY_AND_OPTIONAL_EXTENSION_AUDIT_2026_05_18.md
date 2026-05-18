# Tracker Backlog Alignment After Route Extensibility And Optional Extension Audit

Date: 2026-05-18

## Scope

Audit tracker and backlog alignment after route-family key extensibility,
optional glTF extension warning status, and unregistered route-key app
diagnostics.

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/ARCHITECTURE.md`
- `docs/index.html`
- `docs/render-pipeline-comparison.html`
- `agent/BACKLOG.md`
- `docs/research/ROUTE_FAMILY_KEY_TYPE_BOUNDARY_TEST_AUDIT_2026_05_18.md`
- `docs/research/OPTIONAL_GLTF_MATERIAL_EXTENSION_WARNING_STATUS_AUDIT_2026_05_18.md`
- `docs/research/UNREGISTERED_ROUTE_KEY_APP_DIAGNOSTIC_AUDIT_2026_05_18.md`

## Findings

Pass after tracker and backlog updates.

The public tracker now reflects:

- Decision 0010 route-family key boundary;
- route queue acceptance of syntactically valid registry-style keys;
- app-level diagnostics for valid but unregistered route keys;
- invalid sampler-index and sampler-enum browser diagnostics;
- unsupported optional glTF material-extension warnings that still render the
  base StandardMaterial.

The render pipeline comparison keeps six phase-status entries and still lists
real app-level non-built-in material adapter rendering as missing.

The ready backlog is refilled with concrete categorized tasks:

- `task-1307` — plan next route-boundary or glTF fidelity slice.
- `task-1308` — audit next route-boundary or glTF fidelity plan.
- `task-1309` — add route-key diagnostics summary regression if selected.
- `task-1310` — plan optional-extension warning aggregation or next glTF
  fidelity slice.
- `task-1311` — audit tracker/backlog alignment after the next selected slice.

## Recommendation

Start with `task-1307`.

Keep deferred:

- app-level non-built-in material adapter rendering;
- public custom material source assets;
- IBL, shadows, binary GLB loading, and GLB viewer behavior.

## Validation

- `pnpm run check:progress`
