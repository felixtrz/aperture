# Tracker Backlog Alignment After Queued Source Asset Index Helper Audit - 2026-05-18

## Scope

Confirm tracker and backlog alignment after the queued source asset index helper
extraction and audit.

Reference anchors inspected:

- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/QUEUED_SOURCE_ASSET_INDEX_HELPER_EXTRACTION_AUDIT_2026_05_18.md`
- `agent/BACKLOG.md`
- `docs/index.html`
- `docs/render-pipeline-comparison.html`

## Findings

The tracker should mention that source asset indexing is now a reusable route
helper rather than built-in collector-local code. This is another queue/app route
contract cleanup and does not require percentage changes.

The ready backlog should move to a planning task that compares remaining route
architecture cleanup against StandardMaterial/glTF fidelity. After the helper
extractions in this run, it is reasonable for the next plan to consider
returning to StandardMaterial fidelity if no narrow route helper remains.

## Changes To Make

- Update tracker freshness, latest work, and next focus.
- Mark `task-1506` through `task-1508` complete.
- Keep at least five categorized ready tasks beginning with `task-1509`.
- Run `pnpm run check:progress`.

## Validation

Pending tracker edits and `pnpm run check:progress`.
