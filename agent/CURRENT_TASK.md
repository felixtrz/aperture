# Current Task

If this file names a task, the next agent should prioritize that task over
selecting a new one from `agent/BACKLOG.md`.

Current task: `task-3088` — SSAO (screen-space ambient occlusion).

Status: ready. Tier 19 has shipped `task-3086` MSAA and `task-3087` TAA with
motion vectors. The TAA path now uses ECS-authored temporal jitter, a
history-buffered post effect, renderer-owned motion-vector textures,
geometry-aware main-pass motion-vector output for compatible built-in mesh
scenes, fallback camera-motion clears for unsupported combinations, and
`examples/taa.html` square-canvas browser proof.

Next step: start Tier 20 with depth-readable screen-space post effects by adding
SSAO. Read the `task-3088` references first:
`references/three.js/examples/jsm/postprocessing/SSAOPass.js` and
`references/engine/scripts/posteffects/posteffect-ssao.js`.
