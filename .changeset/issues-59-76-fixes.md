---
"@aperture-engine/math": minor
"@aperture-engine/simulation": minor
"@aperture-engine/runtime": minor
"@aperture-engine/render": minor
"@aperture-engine/app": minor
"@aperture-engine/vite-plugin": minor
"@aperture-engine/cli": minor
---

Resolve issues #59–#76 across math, runtime, headless, render, and codegen.

Fixes: `invertMat4` no longer misclassifies small-uniform-scale matrices as
singular (skinned glTF models at scale ≤ 0.01 animate again);
`animation().playClip()/crossFade()` no-op with a diagnostic on unknown clip
ids instead of aborting the run; the Node glTF/GLB loaders decode base64
data-URI buffers; in-process reset and session-snapshot restore keep
module-scope custom components and resources (stale elics registrations are
re-registered per world, restore pre-registers manifest components, and
`defineResource` descriptors are recorded for restore);
`ecs_get_component_schema` sees runtime-spawned components; the headless
asset mode defaults to `hybrid` so GLB-only scenes render out of the box;
config `render.clearColor` is the default camera background; non-button
`--inject` actions fail loudly; `frame_capture` returns a normalized envelope
on both targets; `input_inject`/`logs_read` work as headless session tools;
render bundles carry the app's tonemap/exposure/bloom config (including the
legacy `radiusPixels`) and the render harness applies it; pointing
`aperture headless` at a browser config names the mode mismatch; scaffolded
tsconfig typechecks systems outside `src/`.

Features: `aperture render serve` keeps a warm render browser across many
bundles and MCP `frame_capture` reuses a persistent render session;
`aperture codegen` regenerates `.aperture/generated` outside a vite build,
codegen evaluates factory/shared configs through the module loader, and a
typed `ApertureGeneratedSignalMap` makes `this.signals.*` strongly typed.
