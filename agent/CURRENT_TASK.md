# Current Task

If this file names a task, the next agent should prioritize that task over
selecting a new one from `agent/BACKLOG.md`.

Current task: `task-3083` — Transmission extension.

Status: ready. Tier 17 has shipped `task-3078` ECS sprites, `task-3079` ECS
skyboxes, `task-3080` ECS-authored fog, and `task-3081` combined outdoor
atmosphere. Tier 18 has started with `task-3082` scalar StandardMaterial
clearcoat: schema fields, glTF `KHR_materials_clearcoat` scalar mapping,
pipeline-key routing, uniform packing, WGSL clearcoat BRDF contribution, and
`examples/clearcoat.html` browser proof are in place.

Next step: continue Tier 18 by adding the StandardMaterial transmission
extension and a visible glass-like proof surface with background visible through
the transmitted material.
