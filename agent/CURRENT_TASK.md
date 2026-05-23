# Current Task

If this file names a task, the next agent should prioritize that task over
selecting a new one from `agent/BACKLOG.md`.

Current task: task-3112.

Status: Tier 20 is complete. The post-Tier-20 audit selected submit efficiency
as the current SOTA blocker. `task-3111` has now closed the first submit
efficiency gap: `writeRenderPassCommands()` tracks active pipeline, bind-group,
vertex-buffer, and index-buffer state, skips redundant state commands between
adjacent compatible draws, and publishes command-pressure metrics through app
status.

Browser proof:

- `examples/standard-queue-phases.html` rendered 8 draw commands with zero
  diagnostics.
- Browser status reported 56 planned state commands, 21 emitted state commands,
  and 35 elided state commands.

Next step: start `task-3112` from `agent/BACKLOG.md`, caching WebGPU render
bundles for unchanged static command plans and publishing bundle create/reuse
status in a browser-visible proof.
