# Current Task

If this file names a task, the next agent should prioritize that task over
selecting a new one from `agent/BACKLOG.md`.

Current task: `task-3145` — pack multiple clustered point shadows through
flattened face metadata.

Status: `task-3144` completed metadata-indexed clustered local shadow softness.

Key findings:

- Clustered local shadow resources now carry renderer-owned
  `filterRadiusTexels` from shadow descriptors through depth resources and into
  the local-light metadata buffer.
- Local-light metadata now uses five words per light: flags, shadow id, shadow
  matrix base, cookie matrix base, and shadow filter radius.
- StandardMaterial WGSL now samples clustered spot and point shadows with the
  metadata-indexed filter radius, allowing hard and soft local shadows in one
  clustered route.
- `examples/clustered-lights.html?enable-cluster-shadow-softness=1` reports
  hard/soft spot radii `[0, 5]`, point radius `3`, `ok: true`, and readback
  probe luminance delta about `57.36`.
- `examples/clustered-lights.html?enable-cluster-shadow-softness-atlas=1`
  reports the same hard/soft readiness through the nonuniform atlas route.

Next step: implement `task-3145`.

Reference anchors for `task-3145`:

- `references/engine/src/scene/lighting/light-texture-atlas.js`.
- `references/engine/src/scene/lighting/lights-buffer.js`.
- `references/three.js/src/renderers/webgl/WebGLShadowMap.js`.
