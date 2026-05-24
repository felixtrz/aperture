# Current Task

If this file names a task, the next agent should prioritize that task over
selecting a new one from `agent/BACKLOG.md`.

Current task: `task-3154` — skip unchanged clustered local-light buffer writes
across frames.

Status: `task-3153` completed clustered local shadow-map caching across frames.

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
  GPU blit pass when source textures are already GPU-owned, and unchanged
  clustered local shadow maps now reuse depth allocations and skip redundant
  spot-shadow submissions once caster/light/layout inputs are stable.
- The next gap is clustered-light upload behavior: unchanged clustered
  local-light params/cells/indices/metadata buffers should be reused without
  rewriting every proof frame when the view/light set and metadata are stable.

Next step: implement `task-3154`.

Reference anchors for `task-3154`:

- `references/engine/src/scene/lighting/world-clusters.js`.
- `references/engine/src/scene/lighting/lights-buffer.js`.
- `references/engine/src/scene/renderer/frame-pass-update-clustered.js`.
