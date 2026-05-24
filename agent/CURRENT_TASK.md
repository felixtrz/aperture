# Current Task

If this file names a task, the next agent should prioritize that task over
selecting a new one from `agent/BACKLOG.md`.

Current task: `task-3151` — add dynamic clustered shadow/cookie atlas slot
allocation.

Status: `task-3150` completed the shadow-aligned clustered cookie atlas path
for compact atlas matrix reuse.

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
- Aperture's browser-proven nonuniform atlas shadow-cookie route now exposes
  per-light shadow atlas regions and builds a shadow-aligned cookie atlas before
  reusing spot-shadow matrices. The static/proof atlas invariant is closed.
- The next gap is dynamic behavior: atlas slots should remain stable, reusable,
  and invalidation-safe as clustered shadow/cookie light sets change rather
  than relying on fixed proof-route tile placement.

Next step: implement `task-3151`.

Reference anchors for `task-3151`:

- `references/engine/src/scene/lighting/light-texture-atlas.js`.
- `references/engine/src/scene/renderer/shadow-map-cache.js`.
- `references/engine/src/scene/lighting/lights-buffer.js`.
