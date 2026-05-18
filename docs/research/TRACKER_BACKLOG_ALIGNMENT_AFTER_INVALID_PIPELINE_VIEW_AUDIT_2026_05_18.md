# Tracker Backlog Alignment After Invalid Pipeline View Audit

Date: 2026-05-18

## Scope

Audit public tracker and ready backlog alignment after `task-1373` added the
generic invalid pipeline-view frame-resource regression and `task-1374` audited
it.

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/ARCHITECTURE.md`
- `docs/index.html`
- `docs/render-pipeline-comparison.html`
- `agent/BACKLOG.md`
- `docs/research/INVALID_PIPELINE_VIEW_FRAME_RESOURCE_REGRESSION_AUDIT_2026_05_18.md`

## Findings

Pass after tracker and backlog edits.

- The public tracker now records invalid pipeline-view diagnostics before
  frame-resource creation.
- The render pipeline comparison page still has six phase-status entries and now
  mentions invalid-pipeline-view diagnostics with zero frame-resource assertions
  in prepare and queue status.
- The ready backlog is refilled with `task-1376` through `task-1380`,
  preserving categorized, scoped planning, audit, implementation,
  implementation-audit, and tracker-alignment tasks.

## Recommendation

Start `task-1376` next. The next planning slice should decide whether to keep
hardening generic route diagnostics or move to DebugNormalMaterial route
activation readiness.

## Validation

- `pnpm run check:progress`
