# GLB Viewer Real-URI Texture Controls Audit — 2026-05-20

## Scope

Audited the GLB viewer real URI texture-control slices added for:

- all StandardMaterial texture slots in one sample;
- occlusion transformed-vs-untransformed controls;
- metallic-roughness transformed-vs-untransformed controls;
- repeat-vs-clamp sampler controls;
- UV0-vs-UV1 image-decode controls.

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

- ECS authority is preserved. The new samples register renderer-independent
  mesh, material, texture, and sampler source assets, replay ECS authoring
  commands, and then render from extracted packets. No renderer-owned scene
  graph or source-state copy was introduced.
- Image decode remains before render preparation. Same-origin PNG URI images
  are decoded to RGBA source data via the existing GLB viewer `resolveImageData`
  contract; prepared WebGPU textures and samplers remain backend-owned.
- Texture-slot semantics remain material data. All-slot, transform-control,
  sampler-control, and UV1-control samples expose slot readiness through source
  material status without mutating render snapshots or ECS components with GPU
  objects.
- Status remains JSON-safe. The new Playwright coverage asserts image index,
  URI, formatted URL, MIME type, dimensions, decoded byte length, sampler
  metadata, UV set, and transform metadata without exposing raw image bytes,
  `Uint8Array`, `ImageBitmap`, canvas objects, bind groups, GPU textures, or
  backend handles.
- Browser coverage is behavior-facing. Pixel assertions compare transformed
  versus untransformed texture slots, repeat versus clamp sampler behavior, UV0
  versus UV1 sampling, all-slot textured output, and scalar controls in actual
  rendered GLB viewer frames.

## Corrective Work

No corrective refactor was required.

## Risks And Follow-Ups

- The same-origin decode path is still example-local. Promoting it into a
  package-level loader should wait for a dedicated async image dependency
  contract.
- The GLB viewer now has broad per-slot real URI coverage. The next useful
  visible slices should combine alpha-state and multi-slot behavior, then add
  switch/unload stress coverage for texture-heavy samples.

## Recommendation

Continue with `task-2089`: add an alpha-mask plus emissive real URI GLB viewer
control sample, keeping the same ECS replay, JSON-safe status, and WebGPU-owned
resource boundaries.
