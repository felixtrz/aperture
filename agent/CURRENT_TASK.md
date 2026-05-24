# Current Task

If this file names a task, the next agent should prioritize that task over
selecting a new one from `agent/BACKLOG.md`.

Current task: task-3130.

Status: `task-3129` completed the combined cascaded directional shadow plus IBL
StandardMaterial route.

Key finding:

- StandardMaterial now has a distinct group-3 light/shadow/IBL route for
  `shadowMap|cascadedShadowMap|iblDiffuse` pipeline keys, so cascaded
  directional shadows bind their 2D-array depth texture alongside diffuse and
  specular IBL cube textures plus the IBL sampler.
- The shader now keeps diffuse/specular IBL in the cascaded receiver final
  color expression instead of falling back to the shadow-only color path.
- `examples/outdoor-scene.html` registers a renderer-owned environment map,
  enables IBL by default, and proves the same worker-authored scene reports
  `cascadedShadowMap`, `iblDiffuse`, and `iblSpecularProof` while preserving
  CSM receiver darkening.

Next step: run `task-3130` from `agent/BACKLOG.md`, adding cluster-aware
local-light shadow/cookie metadata.

Reference anchors for the next task:

- `references/engine/src/scene/lighting/world-clusters.js`.
- `references/engine/src/scene/renderer/forward-renderer.js`.
