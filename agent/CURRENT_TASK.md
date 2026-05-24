# Current Task

If this file names a task, the next agent should prioritize that task over
selecting a new one from `agent/BACKLOG.md`.

Current task: `task-3148` — combine nonuniform local shadow atlases with
clustered cookie atlases.

Status: `task-3147` completed flattened point-shadow arrays with clustered
local cookies.

Key findings:

- `examples/clustered-lights.html?enable-cluster-shadow-cookie-point-array=1`
  now renders two point shadows through 12 flattened cube-face depth-array
  layers, two packed spot-array shadows, and one clustered local spot cookie in
  the same clustered StandardMaterial frame.
- The route composes `clusteredLocalLightShadowCookies`,
  `clusteredLocalLightPointArrayShadows`, and
  `clusteredLocalLightArrayShadows` in one pipeline while omitting the
  dedicated local-cookie matrix storage buffer.
- Status now reports `routePackedShadowCookiePointArrayReady` and
  `routePackedShadowCookiePointArraySamplingOk` separately from the generic
  packed-shadow-cookie readiness.
- Focused browser proof reports `ok: true`, `readbackStatus.ok: true`, four
  supported shadowed lights, one supported cookie, point-shadow layer count
  `12`, diagnostics `0`, and zero relevant WebGPU validation warnings.

Next step: implement `task-3148`.

Reference anchors for `task-3148`:

- `references/engine/src/scene/lighting/light-texture-atlas.js`.
- `references/engine/src/scene/lighting/lights-buffer.js`.
- `references/engine/src/scene/shader-lib/wgsl/chunks/lit/frag/clusteredLightCookies.js`.
- `references/engine/src/scene/shader-lib/wgsl/chunks/lit/frag/clusteredLightShadows.js`.
