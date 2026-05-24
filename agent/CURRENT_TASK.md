# Current Task

If this file names a task, the next agent should prioritize that task over
selecting a new one from `agent/BACKLOG.md`.

Current task: task-3135.

Status: `task-3134` completed cookie-only clustered spot-light projection
matrices.

Key finding:

- Clustered spot-cookie metadata now references a renderer-owned cookie
  projection matrix buffer, separate from spot-shadow matrix resources.
- Cookie-enabled clustered StandardMaterial layouts bind cookie texture,
  sampler, and matrix resources without requiring a shadow depth texture or
  comparison sampler.
- `examples/clustered-lights.html?enable-cluster-cookie-only=1` renders the
  projected spot-cookie pattern through a non-shadow clustered route, reports
  cookie readiness, and disables clustered local shadow sampling for that route.

Next step: run `task-3135` from `agent/BACKLOG.md`, adding clustered
point-light cube cookie sampling.

Reference anchors for the next task:

- `references/engine/src/scene/lighting/lights-buffer.js`.
- `references/engine/src/scene/shader-lib/chunks/lit/frag/light.js`.
- `references/three.js/src/renderers/WebGLRenderer.js`.
