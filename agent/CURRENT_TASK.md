# Current Task

If this file names a task, the next agent should prioritize that task over
selecting a new one from `agent/BACKLOG.md`.

Current task: `task-3146` — combine packed local shadows with clustered local
cookies.

Status: `task-3145` completed multiple clustered point shadows through
flattened cube-face metadata.

Key findings:

- Clustered point-shadow resources can now use one renderer-owned
  `texture_depth_2d_array`, with six consecutive layers per point light and
  per-light metadata selecting the base face/matrix index.
- StandardMaterial declares and samples the flattened point-shadow array route
  when the `clusteredLocalLightPointArrayShadows` pipeline feature is present.
- Multi-shadow layouts now distinguish point depth arrays from point cube
  textures, keeping packed spot-shadow arrays in the same compact group-3
  route.
- `examples/clustered-lights.html?enable-cluster-multi-point-shadow=1` reports
  two supported point shadows, 12 point-shadow layers, two packed spot shadows,
  `clustered-point-array-spot-array-depth-compare`, `ok: true`, and non-clear
  readback.
- The broad clustered-lights Playwright spec was updated for this route, but a
  local headed run went idle and was terminated; focused browser proof passed.

Next step: implement `task-3146`.

Reference anchors for `task-3146`:

- `references/engine/src/scene/lighting/lights-buffer.js`.
- `references/engine/src/scene/shader-lib/wgsl/chunks/lit/frag/clusteredLightCookies.js`.
- `references/engine/src/scene/shader-lib/wgsl/chunks/lit/frag/clusteredLightShadows.js`.
