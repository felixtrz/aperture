# Current Task

No active task is currently checked out.

Status: `task-3173` completed the Developer API entity lookup summary slice.
Generated/headless apps now expose JSON-safe ECS entity summaries for
agent/tool discovery without reading renderer-owned state.

Key findings:

- `@aperture-engine/app/entity-lookup` exports helper functions and a lookup
  facade for exact key, regex name, component, tag, and GLB source filters.
- Summaries return canonical `{ index, generation }`, optional key/name/tags,
  component ids, and source asset/node metadata.
- Stale generation follow-up references return actionable diagnostics that
  suggest rerunning `aperture_entity_find`.
- Headless runner status and generated browser worker summaries include
  JSON-safe entity lookup snapshots.

Recommended next task:

- `task-3174` — forward generated browser/UI commands into worker-owned
  `this.commands` queues and prove a system can request a manual config asset
  without importing loader reports or renderer registration code.
