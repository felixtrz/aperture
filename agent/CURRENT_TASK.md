# Current Task

If this file names a task, the next agent should prioritize that task over
selecting a new one from `agent/BACKLOG.md`.

Current task: `task-3141` — support multiple clustered local spot shadows per
frame.

Status: `task-3140` completed nonuniform clustered spot-cookie atlas metadata
coverage.

Key findings:

- Nonuniform clustered spot cookies now use a renderer-owned 2D atlas when the
  compatible-size 2D-array path cannot cover the same lights.
- The cookie atlas path uploads each source texture into its tile and adjusts
  each spot light's projected cookie matrix into atlas UV space.
- `examples/clustered-lights.html?enable-cluster-cookie-atlas=1` reports two
  supported clustered cookie lights through the non-array 2D cookie pipeline and
  rendered non-clear cookie-modulated pixels in the narrow Chrome/WebGPU proof.
- The remaining visible SOTA gap is broader local shadow atlas/resource
  packing, starting with multiple clustered spot shadows sharing a
  renderer-owned array resource.

Next step: implement `task-3141`.

Reference anchors for `task-3141`:

- `references/engine/src/scene/lighting/light-texture-atlas.js`.
- `references/engine/src/scene/lighting/lights-buffer.js`.
- `references/engine/src/scene/shader-lib/wgsl/chunks/lit/frag/clusteredLightShadows.js`.
