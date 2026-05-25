# Current Task

No active task is currently checked out.

Status: `task-3180` completed JSON-safe entity snapshot/diff helpers for
developer tooling.

Key findings:

- `@aperture-engine/app/entity-lookup` now exposes
  `ApertureEntityLookupSnapshotOptions`, `ApertureEntitySnapshotDiff`, and
  `diffApertureEntityLookupSnapshots(...)`.
- Entity snapshots can be produced from either a find query or explicit
  `{ index, generation }` refs.
- Snapshot diffs key entities by the full `{ index, generation }` pair and
  report added, removed, changed, and unchanged summaries plus changed fields.
- Explicit ref snapshots reuse the existing generation-mismatch diagnostics, so
  stale refs tell agents to rerun entity find.
- Focused headless coverage captures before/after snapshots around the select
  system mutation and sees the `DebugMetadata` component appear in the diff.

Recommended next task:

- `task-3181` — add a constrained entity component mutation helper for
  generated/headless developer tooling without broad arbitrary object mutation.
