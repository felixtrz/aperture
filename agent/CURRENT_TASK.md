# Current Task

If this file names a task, the next agent should prioritize that task over
selecting a new one from `agent/BACKLOG.md`.

Current task: task-3116.

Status: Tier 20 is complete. The post-Tier-20 audit selected submit efficiency
as the current SOTA blocker. `task-3111` closed redundant state-command
emission, `task-3112` closed static command-plan render-bundle reuse,
`task-3113` closed the indirect grouped-draw route, `task-3114` closed
state-aware opaque/alpha-test queue ordering, and `task-3115` closed shared
queued built-in bind-group reuse across compatible frame-resource routes.

Browser proof:

- `examples/standard-queue-phases.html` rendered 8 draw commands with zero
  diagnostics.
- Browser status reported 56 planned state commands, 21 emitted state commands,
  and 35 elided state commands.
- Browser status also reported render-bundle reuse with `encodedCommands: 0` on
  the reused frame.
- `examples/instancing.html` reported one indirect draw candidate, one
  `drawIndexedIndirect` command, one 20-byte argument buffer, one draw call, and
  zero diagnostics.
- `examples/standard-queue-phases.html` reports opaque state-sort pressure: the
  stable nontransparent baseline needs 3 pipeline switches, while the
  state-aware order needs 2.
- `examples/standard-queue-phases.html` now reports queued bind-group reuse:
  3 created shared queued bind groups, 18 reused, and 3 cached entries while
  keeping render-bundle reuse valid.

Next step: start `task-3116` from `agent/BACKLOG.md`, adding previous transform
history for independently moving TAA geometry.
