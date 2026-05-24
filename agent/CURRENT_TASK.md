# Current Task

If this file names a task, the next agent should prioritize that task over
selecting a new one from `agent/BACKLOG.md`.

Current task: `task-3152` — add GPU-updated clustered cookie atlas blits.

Status: `task-3151` completed dynamic clustered shadow/cookie atlas slot
allocation for changing spot shadow-cookie light sets.

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
- The next gap is update behavior: changed cookie atlas tiles should be updated
  through renderer-owned GPU copy/blit work instead of rebuilding CPU-packed
  atlas bytes for every changed source.

Next step: implement `task-3152`.

Reference anchors for `task-3152`:

- `references/engine/src/scene/renderer/render-pass-cookie-renderer.js`.
- `references/engine/src/scene/shader-lib/wgsl/chunks/internal/frag/cookie-blit-2d.js`.
- `references/engine/src/scene/shader-lib/wgsl/chunks/internal/vert/cookie-blit.js`.
