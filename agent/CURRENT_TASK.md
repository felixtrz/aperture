# Current Task

If this file names a task, the next agent should prioritize that task over
selecting a new one from `agent/BACKLOG.md`.

Current task: task-3094 — SSR normal/fresnel/attenuation parity follow-up.

Status: Tier 20 baseline SSAO, SSR, and DOF have shipped as depth-readable post
effects with square raw-vs-effect browser proofs. The strict parity audit found
that additional Tier 20 follow-ups are needed before the user's full objective
can be marked complete. `task-3093` upgraded SSAO toward the PlayCanvas modern
spiral AO reference.

Next step: start `task-3094`, improving SSR toward the three.js `SSRPass`
normal/fresnel/distance-attenuation feature shape without adding a scene-graph
reflector object.
