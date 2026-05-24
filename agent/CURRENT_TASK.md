# Current Task

If this file names a task, the next agent should prioritize that task over
selecting a new one from `agent/BACKLOG.md`.

Current task: `task-3144` — add metadata-indexed clustered local shadow
softness.

Status: `task-3143` completed packed clustered point plus spot local shadows.

Key findings:

- `examples/clustered-lights.html?enable-cluster-packed-shadow=1` reports one
  supported point cube shadow plus two supported metadata-indexed spot shadows
  through the 2D-array route in one clustered StandardMaterial frame.
- `examples/clustered-lights.html?enable-cluster-packed-shadow-atlas=1` reports
  the same point shadow plus two nonuniform atlas-backed spot shadows, with
  atlas size `384x256` and two atlas footprints.
- The compact multi-shadow group-3 layout now switches binding 3 to
  `texture_depth_2d_array` for point plus spot-array routes while preserving
  the point cube binding at 9.
- The remaining visible SOTA gap is local-shadow quality and broader clustered
  tuning, starting with metadata-indexed hard/soft shadow filtering.

Next step: implement `task-3144`.

Reference anchors for `task-3144`:

- `references/engine/src/scene/lighting/lights-buffer.js`.
- `references/engine/src/scene/shader-lib/wgsl/chunks/lit/frag/clusteredLightShadows.js`.
- `references/three.js/src/renderers/webgl/WebGLShadowMap.js`.
