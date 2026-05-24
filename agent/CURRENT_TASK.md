# Current Task

If this file names a task, the next agent should prioritize that task over
selecting a new one from `agent/BACKLOG.md`.

Current task: `task-3153` — cache unchanged clustered local shadow maps across
frames.

Status: `task-3152` completed GPU-updated clustered cookie atlas blits for
changed atlas-backed spot-cookie sources.

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
  per-light shadow atlas regions, builds a shadow-aligned cookie atlas before
  reusing spot-shadow matrices, and allocates stable dynamic atlas slots across
  a changing four-spot shadow-cookie light set.
- Changed atlas-backed spot-cookie sources now update through a renderer-owned
  GPU blit pass when source textures are already GPU-owned, and the proof route
  reports changed-tile GPU blits, cached unchanged tiles, and zero CPU atlas
  uploads.
- The next gap is local-shadow lifetime behavior: unchanged clustered local
  shadow maps should be cached across frames instead of being recreated or
  redrawn every proof frame.

Next step: implement `task-3153`.

Reference anchors for `task-3153`:

- `references/engine/src/scene/renderer/shadow-map-cache.js`.
- `references/engine/src/scene/renderer/shadow-renderer-local.js`.
- `references/engine/src/scene/renderer/render-pass-shadow-local-clustered.js`.
