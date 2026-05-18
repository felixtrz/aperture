# Tracker Backlog Alignment After Diagnostics Route Cleanup Audit

Date: 2026-05-18

## Scope

Audit the public tracker and ready backlog after the diagnostics and route
cleanup run.

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/ROADMAP.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/ARCHITECTURE.md`
- `docs/index.html`
- `docs/render-pipeline-comparison.html`
- `agent/BACKLOG.md`
- completed tasks `task-1225` through `task-1246`

## Findings

Pass. The tracker and backlog are aligned with the latest state.

The public tracker now reflects the main completed work:

- StandardMaterial texture format/color-space diagnostics have source,
  summary, and browser/status coverage.
- Environment-map readiness is available as a JSON-safe report.
- Reusable route scratch and route report shell stale-state behavior are pinned.
- Unsupported required glTF material-extension diagnostics are implemented and
  audited through browser status.

The render pipeline comparison page has a fresh update date and still lists all
six phase status entries. Phase 2 now includes unsupported required glTF
material-extension browser diagnostics, while Phase 4 still calls out route
summary group cleanup and app-level non-built-in adapter migration as missing
pieces.

The ready backlog has five concrete tasks with category, package/write-scope,
reference anchor, and acceptance criteria:

- `task-1242` — audit material-family route migration criteria.
- `task-1243` — add route summary group clean-after-failed regression.
- `task-1247` — plan next post-extension fidelity or route slice.
- `task-1248` — audit next post-extension slice plan.
- `task-1249` — refill after material route criteria audit.

No tracker or backlog item asks for IBL, shadows, binary GLB loading, GLB viewer
behavior, WebGL fallback, or a mutable scene graph as the immediate next slice.

## Validation

- `pnpm run check:progress`
- `git diff --check`

## Recommendation

Proceed to `task-1242`: audit material-family route migration criteria. Keep
`task-1243` ready as the next concrete route summary cleanup if the migration
criteria audit recommends another small diagnostics-boundary test first.
