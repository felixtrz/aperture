# GLB Viewer Transform-Control And Real-Normal Image Audit — 2026-05-20

## Scope

Audited the GLB viewer transformed-vs-untransformed normal/emissive control
fixtures and the real same-origin normal-map image decode slice.

Reference anchors inspected:

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `references/bevy/crates/bevy_gltf/src/loader/mod.rs`
- `references/bevy/crates/bevy_gltf/src/loader/gltf_ext/material.rs`
- `references/three.js/examples/jsm/loaders/GLTFLoader.js`
- `examples/glb-viewer.js`
- `test/e2e/glb-viewer.spec.ts`

## Findings

- ECS authority is preserved. The normal/emissive control fixtures still load
  into renderer-independent mesh, material, texture, and sampler source assets,
  then replay ECS authoring commands before extraction. The viewer does not
  introduce renderer-owned source state or a mutable scene graph.
- Texture transform metadata remains material-slot data. The transformed and
  untransformed control primitives share the same source image handle where
  appropriate, and their status differs only by the slot-scoped
  `KHR_texture_transform` metadata reported on `normalTexture` or
  `emissiveTexture`.
- The real normal-map PNG decode path stays before render preparation. The
  viewer decodes `aperture-normal-checker.png` into RGBA source bytes through
  the `resolveImageData` contract, while WebGPU texture creation remains owned
  by the backend route.
- Status remains JSON-safe. The normal-map sample publishes image index, URI,
  formatted URL, MIME type, dimensions, and decoded byte length only. The
  transformed-control status publishes slot keys and transform metadata without
  exposing raw image bytes, GLB bytes, `ImageBitmap`, canvas, GPU textures,
  samplers, bind groups, or backend handles.
- Browser coverage is behavior-facing. The normal and emissive control tests
  compare transformed, untransformed, and scalar regions in the same rendered
  page, proving the fixture differences are visible rather than status-only.

## Corrective Work

No corrective refactor was required.

## Risks And Follow-Ups

- Same-origin URI image decode remains example-local. Moving it into a
  package-level loading path should be a separate design slice because it needs
  an async image dependency contract rather than a renderer-side shortcut.
- The fallback resolver still exists for deterministic fixtures. New GLB viewer
  fidelity tasks should prefer committed same-origin image files and assert
  `source.imageDecode` when the slice is intended to prove browser image decode.

## Recommendation

Continue with visible GLB viewer fidelity work that broadens real URI texture
coverage across StandardMaterial slots and transform-control samples, while
keeping decoded source bytes before extraction and prepared GPU resources in the
WebGPU backend.
