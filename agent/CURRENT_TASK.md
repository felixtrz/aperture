# Current Task

No active task is currently checked out.

Status: `task-3179` completed the developer API spatial selection proof. The
example now uses worker-side camera and spatial helpers to select the crate and
surfaces the selected entity reference through generated/headless status.

Key findings:

- `SetupSystem` seeds an ECS-owned raycast bounds entry for the interactive
  crate.
- `SelectSystem` now derives a ray from `this.cameras.main` and forwarded
  pointer input, calls `this.spatial.raycast(...)`, writes the selected
  `{ index, generation }` ref to the config signal, and emits the ref in a
  JSON-safe diagnostic.
- Generated worker and headless status now include a JSON-safe `signals`
  summary via `createSignalSummary(...)`.
- The developer API panel displays signals, so `selectedEntity` is visible
  without exposing live systems or renderer state.
- Browser and headless tests now prove the selected entity ref is published.

Recommended next task:

- `task-3180` — add JSON-safe entity snapshot/diff helpers for generated and
  headless developer tooling.
