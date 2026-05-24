# Current Task

If this file names a task, the next agent should prioritize that task over
selecting a new one from `agent/BACKLOG.md`.

Current task: `task-3142` — add atlas-space clustered spot-shadow metadata for
nonuniform maps.

Status: `task-3141` completed multiple clustered local spot shadows per frame.

Key findings:

- Compatible clustered spot-shadow maps now share a renderer-owned 2D depth
  array when they can use the same map size/sampler shape.
- Per-light clustered shadow metadata points each supported spot light at its
  matrix/layer entry without exposing renderer GPU resources through ECS or
  snapshots.
- `examples/clustered-lights.html?enable-cluster-multi-spot-shadow=1` reports
  two supported clustered spot shadows through the array-shadow path and renders
  non-clear shadowed pixels in the narrow Chrome/WebGPU proof with zero relevant
  validation warnings.
- The remaining visible SOTA gap is nonuniform local spot-shadow atlas
  metadata, where spot shadows with incompatible footprints should either pack
  into atlas space or publish an explicit unsupported fallback.

Next step: implement `task-3142`.

Reference anchors for `task-3142`:

- `references/engine/src/scene/lighting/light-texture-atlas.js`.
- `references/engine/src/scene/lighting/lights-buffer.js`.
- `references/engine/src/scene/shader-lib/wgsl/chunks/lit/frag/clusteredLightShadows.js`.
