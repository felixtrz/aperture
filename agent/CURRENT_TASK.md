# Current Task

If this file names a task, the next agent should prioritize that task over
selecting a new one from `agent/BACKLOG.md`.

Current task: task-3131.

Status: `task-3130` completed cluster-aware local-light shadow/cookie
metadata.

Key finding:

- Clustered local-light descriptors now carry a renderer-owned metadata buffer
  alongside params/cells/indices so assigned point/spot lights can preserve
  local shadow/cookie readiness without exposing GPU handles through ECS.
- StandardMaterial clustered layouts, bind groups, pipeline layout keys, and
  shader metadata now include binding 19 for cluster metadata.
- The clustered shader keeps the metadata buffer statically used through an
  imperceptible deferred-shadow compatibility factor, preventing WebGPU
  auto-layout from dropping the binding before future local-shadow sampling is
  implemented.
- `examples/clustered-lights.html` now publishes JSON-safe
  `shadowCookieMetadata` for both active cluster routes, including honest
  `metadata-only` shadow fallback and `not-supported` cookie fallback state
  while keeping direct clustered lighting visible.

Next step: run `task-3131` from `agent/BACKLOG.md`, rendering clustered local
point-light shadows from the metadata route.

Reference anchors for the next task:

- `references/engine/src/scene/lighting/world-clusters.js`.
- `references/engine/src/scene/lighting/lights-buffer.js`.
- `references/three.js/src/renderers/webgl/WebGLShadowMap.js`.
