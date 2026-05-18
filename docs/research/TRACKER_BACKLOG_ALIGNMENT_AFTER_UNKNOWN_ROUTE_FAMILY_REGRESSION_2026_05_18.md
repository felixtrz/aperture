# Tracker/backlog alignment after unknown route family regression - 2026-05-18

## Scope

Audit tracker and backlog alignment after adding and auditing the unknown
material route family diagnostics regression.

Reference anchors inspected:

- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/index.html`
- `docs/render-pipeline-comparison.html`
- `agent/BACKLOG.md`
- `docs/research/UNKNOWN_ROUTE_FAMILY_DIAGNOSTICS_REGRESSION_AUDIT_2026_05_18.md`

## Findings

- The public tracker now mentions the unsupported-family route diagnostics
  regression as route-boundary progress.
- Render pipeline status now records that unsupported route families produce
  grouped JSON-safe route diagnostics with zero routed resources.
- The backlog has at least five categorized, scoped ready tasks after refill.

## Recommendation

Start `task-1553`: plan the next route or StandardMaterial follow-up. The route
boundary is coherent after the unknown-family regression, so the next plan
should compare a deeper route-boundary slice against the next glTF fidelity
slice.

## Validation

- `pnpm run check:progress`
