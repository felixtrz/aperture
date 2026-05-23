# Current Task

If this file names a task, the next agent should prioritize that task over
selecting a new one from `agent/BACKLOG.md`.

Current task: task-3096 — MSAA depth route for screen-space post effects.

Status: Tier 20 baseline SSAO, SSR, and DOF have shipped as depth-readable post
effects with square raw-vs-effect browser proofs. The strict parity audit found
that additional Tier 20 follow-ups are needed before the user's full objective
can be marked complete. `task-3093` upgraded SSAO toward the PlayCanvas modern
spiral AO reference, `task-3094` upgraded SSR toward the three.js `SSRPass`
normal/fresnel/distance-attenuation shape, and `task-3095` upgraded DOF toward
the PlayCanvas/Bevy circle-of-confusion quality shape.

Next step: start `task-3096`, adding a renderer-owned single-sample depth route
or equivalent prepass/resolve path so SSAO, SSR, and DOF can run in MSAA scenes
without example-specific depth plumbing.
