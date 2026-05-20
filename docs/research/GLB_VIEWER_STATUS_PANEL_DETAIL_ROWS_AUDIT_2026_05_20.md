# GLB Viewer Status Panel Detail Rows Audit

Date: 2026-05-20

## Scope

This audit covers the expanded GLB viewer status rows added after the texture
slot, sampler, transform, prepared-resource, and render-diagnostics panels:

- texture handle-key rows;
- pipeline-token rows;
- decoded-image detail rows;
- unsupported-feature detail rows; and
- mesh-draw identity rows.

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `references/bevy/crates/bevy_gltf/src/loader/gltf_ext/material.rs`
- `references/bevy/crates/bevy_gltf/src/loader/mod.rs`
- `references/bevy/crates/bevy_render/src/extract_component.rs`
- `references/bevy/crates/bevy_render/src/diagnostic/mod.rs`
- `references/three.js/examples/jsm/loaders/GLTFLoader.js`
- `references/engine/src/scene/renderer/renderer.js`

## Findings

The current rows remain derived status, not new authority. Texture handle rows
read from `gltf.primitiveMaterials.resolutions[].textureSlots`, pipeline rows
parse already-published primitive `pipelineKey` strings, unsupported-feature
rows summarize existing glTF metadata diagnostics, and mesh-draw rows read the
extracted `RenderSnapshot.meshDraws` packet identity through a JSON-safe
`renderState.draws` projection.

The decoded-image detail rows now include buffer-view backed fallback images in
`source.imageDecode.decoded`. This is still source-status metadata only:
width, height, MIME type, source kind, URI-like label, URL-like label, and byte
length. The raw `Uint8Array`, `ImageBitmap`, source buffer, texture object, and
GPU texture are not published through the status object.

The expanded panels match the Bevy-style boundary inspected here: extraction
and diagnostics copy render-relevant facts into render-facing data, while GPU
resources remain backend-owned. The PlayCanvas renderer reference keeps live
draw calls and GPU updates inside renderer objects; Aperture's viewer only
publishes flat string/number summaries for inspection.

## Boundary Check

- ECS remains authoritative for scene replay, material authoring, transforms,
  lights, and shadow/IBL authoring state.
- Render extraction remains the source of draw identity and queue data.
- Status rows expose stable keys, counts, primitive indices, diagnostic codes,
  and pipeline tokens, not live objects.
- No raw source buffers, decoded image byte arrays, WebGPU handles, or mutable
  renderer state are exposed.
- No scene-graph ownership path was added.

## Recommendation

The GLB viewer status panel is now dense enough for the current diagnostic
track. Shift the next visible task back toward rendered glTF scene fidelity
instead of adding more status rows unless a concrete rendering failure needs a
specific missing inspection row.
