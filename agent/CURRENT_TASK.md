# Current Task

If this file names a task, the next agent should prioritize that task over
selecting a new one from `agent/BACKLOG.md`.

Current task: `task-3080` — Fog.

Status: ready. Tier 17 has started: `task-3078` added ECS `Sprite` authoring,
`withSprite`, snapshot sprite packets, a WebGPU camera-facing billboard path,
and `examples/sprite-billboard.html` with headed Chrome proof across front and
orbit camera snapshots. `task-3079` added ECS `Skybox` authoring,
`withSkybox`, snapshot skybox packets, an infinite-depth WebGPU cube-map
background path, and `examples/skybox.html` with headed Chrome proof.

Next step: add ECS-authored fog parameters for linear, exponential, and
exponential-squared modes, route them through extraction, and prove visible
distance falloff in the WebGPU StandardMaterial path.
