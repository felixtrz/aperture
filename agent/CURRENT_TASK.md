# Current Task

If this file names a task, the next agent should prioritize that task over
selecting a new one from `agent/BACKLOG.md`.

Current task: task-3133.

Status: `task-3132` completed clustered local spot-light shadow sampling.

Key finding:

- Clustered local-light metadata can now mark spot-shadow resources as
  `sampling-ready` when renderer-owned 2D depth, matrix, and sampler resources
  exist for the matching shadow/light pair.
- StandardMaterial clustered spot lights now multiply direct local lighting by
  a spot-shadow visibility factor for supported metadata while preserving
  direct lighting for unsupported metadata-only lights.
- `examples/clustered-lights.html` now exposes an opt-in clustered spot-shadow
  route with a renderer-owned spot shadow pass and JSON-safe supported-route
  status, while the default clustered point-shadow route remains intact.
- The WebGPU app uses pipeline-scoped bind-group layout keys for clustered
  2D/cube shadow StandardMaterial routes to avoid incompatible auto-layout bind
  group reuse between shadowed and non-shadowed clustered pipelines.

Next step: run `task-3133` from `agent/BACKLOG.md`, adding clustered local-light
cookie sampling.

Reference anchors for the next task:

- `references/engine/src/scene/lighting/lights-buffer.js`.
- `references/engine/src/scene/renderer/forward-renderer.js`.
- `references/three.js/src/renderers/WebGLRenderer.js`.
