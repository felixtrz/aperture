# Current Task

If this file names a task, the next agent should prioritize that task over
selecting a new one from `agent/BACKLOG.md`.

Current task: `task-3086` — MSAA support in render passes.

Status: ready. Tier 17 has shipped `task-3078` ECS sprites, `task-3079` ECS
skyboxes, `task-3080` ECS-authored fog, and `task-3081` combined outdoor
atmosphere. Tier 18 has shipped `task-3082` scalar StandardMaterial clearcoat,
`task-3083` scalar thin-wall transmission, `task-3084` scalar
StandardMaterial sheen, and `task-3085` scalar StandardMaterial iridescence:
schema fields, glTF scalar extension mapping, pipeline-key routing, uniform
packing, WGSL direct-light extension behavior, and square browser proofs are in
place.

Next step: start Tier 19 by adding configurable MSAA render-pass support and a
visible edge-quality proof.
