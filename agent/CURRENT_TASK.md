# Current Task

If this file names a task, the next agent should prioritize that task over
selecting a new one from `agent/BACKLOG.md`.

Current task: `task-3139` — pack multiple clustered local shadow resources by
metadata index.

Status: `task-3138` completed mixed clustered point and spot local-shadow proof
coverage.

Key findings:

- `examples/clustered-lights.html?enable-cluster-mixed-shadow=1` now reports
  supported point and spot shadow sampling in one clustered StandardMaterial
  frame, with the combined `clustered-point-spot-depth-compare` mode.
- The first mixed-shadow proof exposed a real browser limit issue: clustered
  local point+spot shadows plus the normal transform storage buffer exceeded
  the default per-stage storage-buffer limit on Chrome/WebGPU.
- The completed slice compacted duplicate spot-shadow group-3 bindings and
  requests `maxStorageBuffersPerShaderStage: 10` when the adapter exposes it,
  which makes the route validate on the local Chrome/WebGPU adapter.
- The remaining SOTA gap is stricter: pack or merge clustered local shadow
  resources so the same mixed route fits WebGPU minimum limits without needing
  the higher requested storage-buffer limit.

Next step: implement `task-3139`.

Reference anchors for `task-3139`:

- `references/engine/src/scene/lighting/light-texture-atlas.js`.
- `references/engine/src/scene/lighting/lights-buffer.js`.
- `references/engine/src/scene/shader-lib/wgsl/chunks/lit/frag/clusteredLightShadows.js`.
