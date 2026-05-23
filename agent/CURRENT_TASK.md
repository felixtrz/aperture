# Current Task

If this file names a task, the next agent should prioritize that task over
selecting a new one from `agent/BACKLOG.md`.

Current task: task-3113.

Status: Tier 20 is complete. The post-Tier-20 audit selected submit efficiency
as the current SOTA blocker. `task-3111` closed redundant state-command
emission, and `task-3112` now closes static command-plan render-bundle reuse:
stable WebGPU command plans can be encoded into renderer-owned render bundles
and executed from cache on later frames when snapshot scheduling reports
unchanged mesh-draw work.

Browser proof:

- `examples/standard-queue-phases.html` rendered 8 draw commands with zero
  diagnostics.
- Browser status reported 56 planned state commands, 21 emitted state commands,
  and 35 elided state commands.
- Browser status also reported one render-bundle creation, later render-bundle
  reuse, 8 draw calls, and `encodedCommands: 0` on the reused frame.

Next step: start `task-3113` from `agent/BACKLOG.md`, adding an indirect draw
argument-buffer route for compatible grouped draws and publishing
creation/fallback status in a browser-visible proof.
