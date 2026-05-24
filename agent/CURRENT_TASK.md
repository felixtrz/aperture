# Current Task

If this file names a task, the next agent should prioritize that task over
selecting a new one from `agent/BACKLOG.md`.

Current task: task-3132.

Status: `task-3131` completed clustered local point-light shadow sampling.

Key finding:

- Clustered local-light metadata can now mark point-shadow resources as
  `sampling-ready` only when renderer-owned cube depth, matrix, and sampler
  resources exist for the matching shadow/light pair.
- StandardMaterial clustered point lights now multiply direct local lighting by
  a point-shadow visibility factor for supported metadata while preserving
  direct lighting for unsupported metadata-only lights.
- `examples/clustered-lights.html` now prepares a renderer-owned point-shadow
  cube pass for the clustered route, proves a readback sample darkens relative
  to the no-point-shadow baseline, and reports zero WebGPU validation warnings.
- The WebGPU app uses pipeline-scoped bind-group layout keys for clustered
  point-shadow StandardMaterial routes to avoid incompatible auto-layout bind
  group reuse between shadowed and non-shadowed clustered pipelines.

Next step: run `task-3132` from `agent/BACKLOG.md`, rendering clustered local
spot-light shadows from the metadata route.

Reference anchors for the next task:

- `references/engine/src/scene/lighting/world-clusters.js`.
- `references/engine/src/scene/lighting/lights-buffer.js`.
- `references/three.js/src/renderers/webgl/WebGLShadowMap.js`.
