# Current Task

If this file names a task, the next agent should prioritize that task over
selecting a new one from `agent/BACKLOG.md`.

Current task: `task-3149` — re-audit clustered shadow/cookie route pressure.

Status: `task-3148` completed nonuniform local shadow atlases with clustered
cookie atlases.

Key findings:

- `examples/clustered-lights.html?enable-cluster-shadow-cookie-atlas=1` now
  renders one point shadow, two nonuniform atlas-backed spot shadows, and two
  nonuniform atlas-backed clustered spot cookies in the same StandardMaterial
  frame.
- The dedicated atlas route keeps the array-shadow route disabled, uses the
  compact `clusteredLocalLightShadowCookies|pointShadowMap|shadowMap`
  pipeline, and omits the cookie-matrix storage buffer.
- Status now reports `routePackedShadowCookieAtlasShadowReady`,
  `routePackedShadowCookieAtlasCookieReady`, and
  `routePackedShadowCookieAtlasSamplingOk` separately.
- Focused browser proof reports `ok: true`, `readbackStatus.ok: true`, two
  supported atlas-backed spot shadows, two supported atlas-backed cookies,
  three supported shadowed lights total, diagnostics `0`, and zero relevant
  WebGPU validation warnings.

Next step: implement `task-3149`.

Reference anchors for `task-3149`:

- `references/engine/src/scene/lighting/light-texture-atlas.js`.
- `references/engine/src/scene/lighting/lights-buffer.js`.
- `references/engine/src/scene/shader-lib/wgsl/chunks/lit/frag/clusteredLightCookies.js`.
- `references/engine/src/scene/shader-lib/wgsl/chunks/lit/frag/clusteredLightShadows.js`.
- `references/three.js/src/renderers/webgl/WebGLShadowMap.js`.
