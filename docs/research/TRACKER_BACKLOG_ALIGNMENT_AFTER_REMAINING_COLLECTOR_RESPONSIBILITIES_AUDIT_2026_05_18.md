# Tracker Backlog Alignment After Remaining Collector Responsibilities Audit - 2026-05-18

## Scope

Confirm tracker and backlog alignment after auditing remaining built-in
collector responsibilities.

Reference anchors inspected:

- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/REMAINING_BUILT_IN_COLLECTOR_RESPONSIBILITIES_AUDIT_2026_05_18.md`
- `agent/BACKLOG.md`
- `docs/index.html`
- `docs/render-pipeline-comparison.html`

## Findings

The audit selected one concrete implementation follow-up: extract generic queued
source asset indexing out of the built-in collector. The public tracker should
point at that implementation because it is the next route-contract cleanup.

No render-pipeline percentage changes are needed. The selected work is a
source-asset lookup helper extraction inside the app route collector path, not a
new rendering feature.

The backlog should mark the remaining collector responsibility audit complete
and add the selected implementation plus a follow-up audit/tracker queue.

## Changes To Make

- Update tracker status and next-focus text.
- Mark `task-1501` and this alignment task complete.
- Add the selected queued source asset index helper task and a small follow-up
  audit/planning queue.
- Run `pnpm run check:progress`.

## Validation

Pending tracker edits and `pnpm run check:progress`.
