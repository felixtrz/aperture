# Current Task

If this file names a task, the next agent should prioritize that task over
selecting a new one from `agent/BACKLOG.md`.

Current task: task-3095 — DOF PlayCanvas/Bevy CoC quality follow-up.

Status: Tier 20 baseline SSAO, SSR, and DOF have shipped as depth-readable post
effects with square raw-vs-effect browser proofs. The strict parity audit found
that additional Tier 20 follow-ups are needed before the user's full objective
can be marked complete. `task-3093` upgraded SSAO toward the PlayCanvas modern
spiral AO reference, and `task-3094` upgraded SSR toward the three.js
`SSRPass` normal/fresnel/distance-attenuation shape.

Next step: start `task-3095`, improving DOF toward the PlayCanvas/Bevy
circle-of-confusion quality shape without moving depth/post processing into an
example-specific viewer path.
