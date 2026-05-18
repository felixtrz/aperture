# Tracker Backlog Alignment After Built-In Item Generic Contract Audit - 2026-05-18

## Scope

Audit tracker and backlog alignment after `task-1462` and `task-1463`.

Reference anchors inspected:

- `docs/NORTH_STAR.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/ARCHITECTURE.md`
- `docs/index.html`
- `docs/render-pipeline-comparison.html`
- `agent/BACKLOG.md`
- `docs/research/BUILT_IN_APP_RESOURCE_ITEM_GENERIC_CONTRACT_AUDIT_2026_05_18.md`

## Findings

The public tracker needed a small route-contract update:

- `docs/index.html` now records that the built-in app resource item is a typed
  specialization of the generic route item contract.
- `docs/render-pipeline-comparison.html` now names `task-1462` as the latest
  queue-phase status marker and lists the built-in item specialization.

No completion percentages changed. This is a type-boundary cleanup over derived
route items, not a new material feature.

The backlog has been extended through the next planning task. The next plan
should decide whether the immediate route cleanup is sufficient and whether to
return to StandardMaterial/glTF fidelity.

## Validation

Run `pnpm run check:progress` after formatting tracker changes.

## Recommendation

Proceed to a planning task that weighs one more route cleanup against the next
StandardMaterial/glTF browser-fidelity slice.
