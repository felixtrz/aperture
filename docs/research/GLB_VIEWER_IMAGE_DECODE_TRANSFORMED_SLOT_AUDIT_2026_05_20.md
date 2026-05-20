# GLB Viewer Image-Decode And Transformed-Slot Audit — 2026-05-20

## Scope

Audited the GLB viewer slices for same-origin JPEG URI decode, transformed
normal texture metadata, and transformed emissive texture metadata.

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

- ECS authority is preserved. The JPEG, normal-transform, and
  emissive-transform fixtures still enter the runtime as source mesh, material,
  texture, and sampler assets, then replay ECS authoring commands before render
  extraction. No renderer-owned scene graph or source-state copy was added.
- Image decode remains renderer-independent. Same-origin PNG/JPEG URI images
  are decoded into RGBA source bytes before GLB source-asset mapping. The
  decoder passes only width, height, format, byte rows, and pixel bytes through
  the existing `resolveImageData` contract; prepared WebGPU textures are still
  created only by the backend app route.
- Status remains JSON-safe. `source.imageDecode` reports image index, URI,
  formatted URL, MIME type, dimensions, and decoded byte length. It does not
  expose raw decoded bytes, `ImageBitmap`, `Canvas`, `Uint8Array`, GLB bytes,
  GPU texture handles, samplers, bind groups, or backend resources.
- Transformed texture-slot metadata stays slot-scoped. The normal and emissive
  samples preserve `KHR_texture_transform` on `normalTexture` and
  `emissiveTexture`, respectively, and the compact GLB viewer status reports
  `hasTransform` plus rounded offset, scale, and rotation data on the matching
  texture slot.
- Render pipeline ownership is unchanged. Pipeline-key selection and WebGPU
  blending/depth/cull state remain backend-derived from StandardMaterial
  source data; the example does not allocate GPU resources for imported GLB
  textures directly.
- The synthetic image resolver remains fallback-only for older deterministic
  GLB fixtures. New JPEG decode coverage proves browser image decode for a real
  same-origin `.jpg`; transformed normal/emissive fixtures continue to reuse
  existing deterministic fallback images to isolate texture-slot metadata and
  shader routing behavior.

## Corrective Work

No corrective refactor was required.

## Risks And Follow-Ups

- Same-origin image decode is still example-local and predecode-based. A
  package-level async image dependency pipeline should be a separate design
  slice if broader glTF URI image loading moves out of the example.
- Failed same-origin image fetches can still fall back silently when an older
  deterministic fixture has a synthetic resolver branch. A future package-level
  loader should distinguish required real-image decode failures from fixture
  fallback paths.
- The transformed normal/emissive samples prove metadata routing and visible
  pixels, but they do not yet compare transformed sampling against an
  untransformed GLB control in the same page.

## Recommendation

Continue with visible GLB fidelity work that broadens real URI image decode or
adds transformed texture-slot controls with browser-visible pixel differences,
while keeping source decode before extraction and GPU preparation inside the
WebGPU backend.
