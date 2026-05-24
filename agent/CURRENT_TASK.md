# Current Task

If this file names a task, the next agent should prioritize that task over
selecting a new one from `agent/BACKLOG.md`.

Current task: `task-3147` — combine flattened point-shadow arrays with
clustered local cookies.

Status: `task-3146` completed the first packed shadow-plus-cookie route.

Key findings:

- `examples/clustered-lights.html?enable-cluster-shadow-cookie=1` now renders
  one supported point shadow, two packed spot-array shadows, and one clustered
  local spot cookie in the same clustered StandardMaterial frame.
- The combined route uses the `clusteredLocalLightShadowCookies` pipeline
  feature and omits the dedicated local-cookie matrix storage buffer, reusing
  the spot-shadow matrix instead so the fragment-stage storage-buffer count
  remains within the WebGPU minimum limit.
- Status now separately reports packed shadow readiness, cookie readiness,
  shadow-cookie pipeline readiness, and combined sampling readiness.
- Focused browser proof reports `ok: true`, `readbackStatus.ok: true`, three
  supported shadowed lights, one supported cookie, diagnostics `0`, and zero
  relevant WebGPU validation warnings.

Next step: implement `task-3147`.

Reference anchors for `task-3147`:

- `references/engine/src/scene/lighting/lights-buffer.js`.
- `references/engine/src/scene/shader-lib/wgsl/chunks/lit/frag/clusteredLightCookies.js`.
- `references/engine/src/scene/shader-lib/wgsl/chunks/lit/frag/clusteredLightShadows.js`.
- `references/engine/src/scene/lighting/light-texture-atlas.js`.
