# Current Task

No active task is currently checked out.

Status: active `docs/DEVELOPER_API_PROPOSAL.md` implementation goal completed.
`task-3184`, `task-3185`, and `task-3186` are complete.

Key findings:

- `@aperture-engine/app/commands` now names generated entity find, get,
  set-component, snapshot, and diff command channels.
- Generated simulation workers intercept those devtool commands before system
  command queues, read/mutate only worker-owned ECS state, and publish
  JSON-safe `entityTools` status with find/get/mutation/snapshot/diff results
  and diagnostics.
- The developer API panel now has Find crate, Get, Set note, Snapshot, Diff,
  Request decal, and Invalid command controls. It dispatches generated commands
  and displays returned status/failure diagnostics without main-thread ECS
  access.
- Browser coverage triggers invalid command diagnostics through the panel and
  sees the stable `aperture.command.invalid` code plus suggested fix.
- Focused unit and browser coverage prove pending generated commands return
  entity tool status from a worker-owned world.

Recommended next task:

- `task-3166` — resume the render-pipeline queue with a split-screen
  multi-camera route.
