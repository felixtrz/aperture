# Current Task

If this file names a task, the next agent should prioritize that task over
selecting a new one from `agent/BACKLOG.md`.

Current task: `task-3140` — add atlas-space clustered cookie metadata for
nonuniform local cookies.

Status: `task-3139` completed minimum-limit mixed clustered local-shadow
coverage.

Key findings:

- Packed StandardMaterial light buffers now carry transform-derived light
  positions, directions, and area axes for fragment-stage lighting.
- The mixed clustered point/spot local-shadow route no longer reads
  `worldTransforms` from the fragment stage and no longer requests
  `maxStorageBuffersPerShaderStage: 10`.
- The narrow Chrome/WebGPU proof for
  `examples/clustered-lights.html?enable-cluster-mixed-shadow=1` still reports
  supported point, spot, and mixed shadow sampling with zero relevant validation
  warnings.
- The remaining visible SOTA gap is atlas-space metadata for clustered local
  cookies that cannot share the current compatible-size 2D-array path.

Next step: implement `task-3140`.

Reference anchors for `task-3140`:

- `references/engine/src/scene/lighting/light-texture-atlas.js`.
- `references/engine/src/scene/lighting/lights-buffer.js`.
- `references/engine/src/scene/shader-lib/wgsl/chunks/lit/frag/clusteredLightCookies.js`.
