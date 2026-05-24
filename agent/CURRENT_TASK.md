# Current Task

If this file names a task, the next agent should prioritize that task over
selecting a new one from `agent/BACKLOG.md`.

Current task: `task-3150` — add shadow-aligned clustered cookie atlas for
compact matrix reuse.

Status: `task-3149` completed the clustered shadow/cookie route-pressure audit.

Key findings:

- Aperture's compact clustered local shadow/cookie array route and flattened
  point-array route are current against the cited three.js and PlayCanvas
  pressure references in the covered StandardMaterial scope.
- three.js is behind this specific clustered-light pressure lane: its
  `WebGLShadowMap` path allocates per-light render targets or cube render
  targets and renders per shadow face, without clustered cookie packing.
- PlayCanvas remains the closer SOTA reference. Its `LightTextureAtlas` assigns
  one atlas slot per light for both shadow and cookie atlas use, and
  `LightsBuffer` writes a projection/viewport layout that stays consistent for
  clustered shadow and cookie sampling.
- Aperture's browser-proven nonuniform atlas shadow-cookie route currently
  reuses spot-shadow matrices, but the generic cookie atlas is packed
  independently by cookie source texture dimensions. The compact atlas route
  needs a shadow-aligned cookie atlas invariant before the matrix-reuse path is
  generally correct for arbitrary nonuniform cookie dimensions.

Next step: implement `task-3150`.

Reference anchors for `task-3150`:

- `references/engine/src/scene/lighting/light-texture-atlas.js`.
- `references/engine/src/scene/lighting/lights-buffer.js`.
- `references/engine/src/scene/shader-lib/wgsl/chunks/lit/frag/clusteredLightCookies.js`.
- `references/engine/src/scene/shader-lib/wgsl/chunks/lit/frag/clusteredLightShadows.js`.
