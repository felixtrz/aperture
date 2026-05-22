# Current Task

If this file names a task, the next agent should prioritize that task over
selecting a new one from `agent/BACKLOG.md`.

Current task: `task-3082` — Clearcoat extension.

Status: ready. Tier 17 has shipped `task-3078` ECS sprites, `task-3079` ECS
skyboxes, `task-3080` ECS-authored fog, and `task-3081` combined outdoor
atmosphere. `examples/atmosphere.html` now proves a worker-authored square
scene with visible skybox pixels, sprite billboard quadrant pixels, and near/far
StandardMaterial fog falloff in one submitted Chrome/WebGPU frame.

Next step: start Tier 18 by adding the StandardMaterial clearcoat extension and
a visible proof surface with a clearcoat highlight distinct from the base
specular lobe.
