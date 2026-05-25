# Current Task

No active task is currently checked out.

Status: `task-3170` completed the Developer API GLB replay slice. Configured
`asset.gltf(...)` handles now load/register source GLB assets during preload,
and `this.spawn.gltf(this.assets.gltf("robot"))` replays loaded GLB primitives
through ECS without user-authored loader, transfer-package, or renderer
registration code.

Key findings:

- The generated browser example now renders two mesh draws: the setup-system
  crate and the config-declared GLB cube.
- Blocking GLB preload completes before system startup in the default app path.
- Background/manual asset readiness remains observable through the existing
  `this.assets` signals and command request path.
- The browser Playwright proof passes with the list reporter. The local line
  reporter hung after the test body in this environment, so use the list
  reporter for this focused spec unless that reporter issue is investigated.

Recommended next task:

- `task-3171` — forward generated browser input events into worker-owned
  `this.input` signals and prove a reactive system can mutate ECS through
  `this.effects.watch(...)`.
