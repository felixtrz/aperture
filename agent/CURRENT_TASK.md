# Current Task

If this file names a task, the next agent should prioritize that task over
selecting a new one from `agent/BACKLOG.md`.

Current task: `task-3081` — Outdoor atmosphere example.

Status: ready. Tier 17 has shipped `task-3078` ECS sprites, `task-3079` ECS
skyboxes, and `task-3080` ECS-authored fog. Fog now supports linear,
exponential, and exponential-squared modes through extraction, view uniforms,
and StandardMaterial shader specialization, with `examples/fog.html` proving
visible distance falloff in headed Chrome/WebGPU.

Next step: combine sprites, skybox, and fog in one worker-authored outdoor
atmosphere scene and prove each feature remains visible.
