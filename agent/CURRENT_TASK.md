# Current Task

If this file names a task, the next agent should prioritize that task over
selecting a new one from `agent/BACKLOG.md`.

Current task: task-3134.

Status: `task-3133` completed clustered local-light cookie sampling.

Key finding:

- ECS/runtime authoring now exposes `withLightCookie(texture, { sampler,
intensity })` for renderer-independent local-light cookie handles.
- Extraction carries ready cookie texture/sampler handles into `LightPacket`s,
  and packed snapshot encoding preserves those handles across transport.
- WebGPU prepares supported clustered spot-cookie texture/sampler resources
  from the app asset registry, marks matching clustered metadata as
  `sampling-ready`, and binds cookie resources only for cookie-enabled
  StandardMaterial pipeline variants.
- `examples/clustered-lights.html?enable-cluster-cookie=1` proves the clustered
  spot-cookie route with JSON-safe readiness, changed readback samples, and zero
  WebGPU validation warnings in a fresh headed browser probe.

Next step: run `task-3134` from `agent/BACKLOG.md`, adding cookie-only
clustered spot-light projection matrices so spot cookies no longer require
shadow resources.

Reference anchors for the next task:

- `references/engine/src/scene/lighting/light-camera.js`.
- `references/engine/src/scene/lighting/lights-buffer.js`.
- `references/three.js/src/renderers/webgl/WebGLLights.js`.
