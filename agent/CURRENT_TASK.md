# Current Task

If this file names a task, the next agent should prioritize that task over
selecting a new one from `agent/BACKLOG.md`.

Current task: task-3129.

Status: `task-3128` completed the light-driven clustered local-light fill
slice.

Key finding:

- The previous CPU-side cluster-build efficiency blocker is closed for the
  covered StandardMaterial route. Cluster descriptor generation now iterates
  each local light, computes its touched cluster cell min/max range, and writes
  only those candidate cells after precise sphere-vs-cell rejection.
- JSON-safe local-light cluster reports now publish build-pressure telemetry:
  assignment strategy, naive cell/light pair tests, per-light range tests,
  light-cell write attempts, stored references, and skipped overflow
  references.
- `examples/clustered-lights.html` proves two active 64-light view/light-set
  routes still render through clustered StandardMaterial, with route pressure
  lower than the old `cellCount * clusteredLocalLights` scan shape.
- The next SOTA feature-combination blocker is StandardMaterial CSM plus IBL in
  one group-3 route. Current coverage proves CSM and IBL separately, but the
  route selection still needs to bind a cascaded 2D-array shadow map together
  with diffuse/specular IBL textures and sampler.

Next step: run `task-3129` from `agent/BACKLOG.md`, combining cascaded
directional shadows with diffuse/specular IBL in one browser-proven
StandardMaterial route.

Reference anchors for the next task:

- `references/three.js/src/renderers/WebGLRenderer.js`.
- `references/engine/src/scene/renderer/forward-renderer.js`.
