# GLB Viewer UV1 and Expanded Texture-Status Audit — 2026-05-20

## Scope

Audited the GLB viewer slices added around missing/supporting `TEXCOORD_1`,
alpha-mask render state, metallic-roughness UV1 sampling, normal-scale status,
and occlusion texture transforms.

Reference anchors:

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `references/bevy/crates/bevy_gltf/src/loader/mod.rs`
- `references/bevy/crates/bevy_gltf/src/loader/gltf_ext/material.rs`
- `references/three.js/examples/jsm/loaders/GLTFLoader.js`

## Findings

- ECS authority is preserved. The viewer still replays GLB source data into
  ECS-authored mesh/material handles, then rendering derives from extraction
  snapshots. None of the new samples introduce a renderer-owned scene graph.
- The UV1 path is renderer-independent source data. `TEXCOORD_1` is parsed as a
  mesh primitive attribute, validated with the same VEC2/float contract as
  `TEXCOORD_0`, and packed into mesh asset vertex data before extraction.
- Missing-UV1 diagnostics remain localized. The missing-`TEXCOORD_1` fixture
  skips only the affected textured primitive while its scalar control primitive
  still registers, replays, extracts, and renders.
- Expanded viewer status remains JSON-safe. `alphaCutoff`, `normalScale`,
  `occlusionStrength`, texture-slot transforms, sampler summaries, and
  extraction diagnostics are serialized as strings, finite numbers, arrays, or
  plain objects. GPU handles and backend resources are not exposed.
- WebGPU ownership is unchanged. Prepared textures/samplers and pipeline
  routing still live behind the WebGPU/app route; the viewer reports stable
  handle keys and pipeline keys only.
- The texture-transform path remains slot-scoped. Base-color, occlusion, and
  UV1 texture metadata are preserved as material source metadata, with shader
  routing determined from extracted material assets.

## Risks And Follow-Ups

- The committed synthetic GLB samples still use example-local URI image
  resolution (`resolveGlbViewerImageData`) instead of general image decoding.
  This is acceptable for deterministic fixtures, but broader GLB image decode
  remains the next fidelity gap.
- `normalScale` and `occlusionStrength` now appear in the viewer's compact
  material factor status. Keep future scalar material-factor fields in this
  JSON-safe summary rather than leaking prepared uniform buffers.

## Recommendation

Continue with visible GLB fidelity work before another planning slice. The
highest-value next task is replacing one example-local synthetic image path with
a real GLB image decode route while preserving deterministic diagnostics.
