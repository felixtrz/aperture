# Tracker Backlog Alignment After Generic App Resource Set Audit - 2026-05-18

## Scope

Audit tracker and backlog alignment after `task-1458` and `task-1459`.

Reference anchors inspected:

- `docs/NORTH_STAR.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/ARCHITECTURE.md`
- `docs/index.html`
- `docs/render-pipeline-comparison.html`
- `agent/BACKLOG.md`
- `docs/research/GENERIC_QUEUED_MATERIAL_APP_RESOURCE_SET_CONTRACT_AUDIT_2026_05_18.md`

## Findings

The public tracker needed a small update because the generic app resource set is
a render-route contract cleanup.

Updated:

- `docs/index.html` now records the generic queued material app resource set and
  the built-in set compatibility relationship.
- `docs/render-pipeline-comparison.html` now names `task-1458` as the latest
  queue-phase status marker and lists the generic app resource set contract.

No percentages changed. The implementation makes route contracts more generic,
but it still does not add real app-level non-built-in material rendering,
instancing, batching, multi-material primitive rules, binary GLB loading, IBL,
shadows, or shader changes.

## Validation

Run `pnpm run check:progress` after formatting tracker changes.

## Recommendation

Add or select the next ready planning task before the end-of-run cleanup so the
backlog stays populated with concrete route or StandardMaterial slices.
