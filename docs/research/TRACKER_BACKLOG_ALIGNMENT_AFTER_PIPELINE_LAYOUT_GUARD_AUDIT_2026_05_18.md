# Tracker Backlog Alignment After Pipeline Layout Guard Audit

Date: 2026-05-18

## Scope

Audit public tracker and ready backlog alignment after `task-1368` added the
generic missing-pipeline-layout frame-resource regression and `task-1369`
audited it.

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/ARCHITECTURE.md`
- `docs/index.html`
- `docs/render-pipeline-comparison.html`
- `agent/BACKLOG.md`
- `docs/research/PIPELINE_LAYOUT_MISSING_FRAME_RESOURCE_REGRESSION_AUDIT_2026_05_18.md`

## Findings

Pass after tracker and backlog edits.

- The public tracker now records the generic missing-pipeline-layout
  frame-resource guard.
- The render pipeline comparison page still has six phase-status entries and now
  mentions missing-pipeline-layout diagnostics with zero frame-resource
  assertions in prepare and queue status.
- The ready backlog is refilled with `task-1371` through `task-1375`,
  preserving categorized, scoped planning, audit, implementation,
  implementation-audit, and tracker-alignment tasks.

## Recommendation

Start `task-1371` next. The next planning slice should continue route and
prepared-resource contract work, now that the generic collector has successful,
dependency-failure, and missing-layout coverage.

## Validation

- `pnpm run check:progress`
