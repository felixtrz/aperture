# GLB Viewer Unsupported/Texture-Status Audit — 2026-05-20

## Scope

Audited the recent `glb-viewer` slices for unsupported morph targets, skinning,
orthographic cameras, unsupported primitive modes, emissive factors, sampler
state, texture transforms, and missing `TEXCOORD_1` diagnostics.

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

- ECS remains authoritative. GLB assets still load into source assets, register
  through typed handles, resolve primitive materials, and replay nodes through
  `applyGltfEcsCommandPlanToApp(...)` before extraction.
- Unsupported metadata is report-only unless an individual primitive is invalid.
  Morph targets, skins, and orthographic cameras publish JSON-safe counts or
  camera metadata while the supported base mesh remains replayed and rendered.
- Unsupported primitive modes are scoped to the affected primitive. The warning
  includes mesh/primitive/mode metadata, and supported primitives in the same
  GLB still register, replay, extract, and draw.
- Texture and sampler status remains renderer-independent. Sampler wrapping and
  filtering, texture-transform metadata, texture-slot `texCoord`, and missing
  `TEXCOORD_1` diagnostics are published as source/extraction status; no GPU
  texture, sampler, bind group, or scene graph state is exposed as authoritative
  viewer data.
- The missing-`TEXCOORD_1` viewer slice is aligned with the existing render
  boundary: the textured primitive resolves as a material asset, extraction
  emits `render.standardMaterialTexture.missingTexCoord1`, skips only that draw,
  and the scalar control primitive still renders through the normal WebGPU app
  path.
- Status remains JSON-safe. The viewer publishes indices, stable asset keys,
  scalar factors, sampler enums, transform numbers, and sanitized diagnostics;
  it does not publish raw GLB bytes, image bytes, GPU handles, or mutable
  renderer objects.

## Corrective Work

No corrective refactor was required. The only status surface added in this run
is a sanitized extraction-diagnostic list so the viewer can show the existing
missing-`TEXCOORD_1` diagnostic without exposing non-serializable state.

## Recommended Next Visible Slice

Add a GLB viewer sample that exercises a StandardMaterial occlusion texture with
an emissive texture or factor control. The slice should keep the sample
ECS-authored, publish JSON-safe texture-slot and factor status, and verify a
visible difference from a scalar control primitive in Playwright.
