# Current Task

If this file names a task, the next agent should prioritize that task over
selecting a new one from `agent/BACKLOG.md`.

Current task: `task-3143` — combine clustered point shadows with packed
spot-shadow metadata.

Status: `task-3142` completed atlas-space clustered spot-shadow metadata for
nonuniform maps.

Key findings:

- Nonuniform clustered spot-shadow maps now share one renderer-owned 2D atlas
  depth texture when they cannot use the compatible-size 2D-array route.
- The atlas path adjusts each supported spot light's receiver matrix into its
  atlas viewport, preserves renderer-owned depth resources, and keeps the
  clustered metadata matrix index distinct from array layer indices.
- `examples/clustered-lights.html?enable-cluster-spot-shadow-atlas=1` reports
  two supported clustered spot shadows with non-identical 256 and 128 atlas
  footprints and renders non-clear shadowed pixels in the narrow Chrome/WebGPU
  proof with zero relevant validation warnings.
- The remaining visible SOTA gap is combining clustered point shadows with the
  packed spot-shadow metadata routes in one WebGPU-minimum StandardMaterial
  frame.

Next step: implement `task-3143`.

Reference anchors for `task-3143`:

- `references/engine/src/scene/lighting/light-texture-atlas.js`.
- `references/engine/src/scene/lighting/lights-buffer.js`.
- `references/three.js/src/renderers/webgl/WebGLShadowMap.js`.
