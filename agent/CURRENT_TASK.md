# Current Task

If this file names a task, the next agent should prioritize that task over
selecting a new one from `agent/BACKLOG.md`.

Current task: `task-3087` — TAA with motion vectors.

Status: ready. Tier 17 has shipped `task-3078` ECS sprites, `task-3079` ECS
skyboxes, `task-3080` ECS-authored fog, and `task-3081` combined outdoor
atmosphere. Tier 18 has shipped `task-3082` scalar StandardMaterial clearcoat,
`task-3083` scalar thin-wall transmission, `task-3084` scalar
StandardMaterial sheen, and `task-3085` scalar StandardMaterial iridescence:
schema fields, glTF scalar extension mapping, pipeline-key routing, uniform
packing, WGSL direct-light extension behavior, and square browser proofs are in
place. Tier 19 has shipped `task-3086` MSAA support in render passes:
`createWebGpuApp({ msaa })` accepts 1x/4x/8x requests, clamps 8x requests to
effective 4x on WebGPU with an explicit report, resolves multisampled color
targets into square canvases, and proves smoother edges in
`examples/msaa.html`.

Next step: continue Tier 19 by adding TAA with motion vectors and a visible
moving-scene temporal smoothing proof.
