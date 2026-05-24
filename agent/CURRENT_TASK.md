# Current Task

If this file names a task, the next agent should prioritize that task over
selecting a new one from `agent/BACKLOG.md`.

Current task: task-3136.

Status: `task-3135` completed clustered point-light cube cookie sampling.

Key finding:

- Point lights can now carry ECS-authored cube-cookie texture handles without
  renderer GPU resources leaking into ECS state.
- Cookie-enabled clustered StandardMaterial layouts specialize the binding-20
  texture view dimension for 2D spot cookies versus cube point cookies.
- Clustered point-light WGSL samples cube-cookie color through the supported
  local-light cookie metadata path while preserving direct lighting for
  unsupported cookie requests.
- `examples/clustered-lights.html?enable-cluster-point-cookie=1` renders the
  point cube-cookie route, reports supported cookie readiness, disables
  clustered shadow resources for the proof route, and keeps WebGPU validation
  warnings at zero in the narrow Chrome proof.

Next step: run `task-3136` from `agent/BACKLOG.md`, supporting multiple
clustered local-light cookies per frame.

Reference anchors for the next task:

- `references/engine/src/scene/lighting/lights-buffer.js`.
- `references/engine/src/scene/renderer/forward-renderer.js`.
- `references/three.js/src/renderers/webgl/WebGLLights.js`.
