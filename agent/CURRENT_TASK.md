# Current Task

If this file names a task, the next agent should prioritize that task over
selecting a new one from `agent/BACKLOG.md`.

Current task: post-task-3136 render-pipeline audit.

Status: `task-3136` completed multiple clustered local-light cookies per frame.

Key finding:

- Compatible clustered spot-cookie texture handles now pack into a
  renderer-owned `2d-array` texture resource with a matching matrix buffer.
- Cluster metadata word 3 records the per-light matrix/array-layer index used
  by the StandardMaterial clustered shader.
- `examples/clustered-lights.html?enable-cluster-multi-cookie=1` renders two
  differently patterned local spot cookies in one clustered frame, reports two
  supported cookie lights, and kept WebGPU validation warnings at zero in the
  narrow Chrome proof.

Next step: re-audit the covered render pipeline against the local PlayCanvas
and three.js references, then select the next visible SOTA slice.

Reference anchors for the next audit:

- `docs/render-pipeline-comparison.html`.
- `references/engine/src/scene/lighting/lights-buffer.js`.
- `references/engine/src/scene/lighting/light-texture-atlas.js`.
- `references/engine/src/scene/renderer/forward-renderer.js`.
- `references/three.js/src/renderers/webgl/WebGLLights.js`.
