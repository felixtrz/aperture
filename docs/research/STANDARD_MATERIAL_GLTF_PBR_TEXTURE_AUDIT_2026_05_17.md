# StandardMaterial glTF PBR Texture Audit - 2026-05-17

## Scope

This audit compares Aperture's current `StandardMaterial` texture behavior
against the near-term glTF metallic-roughness target. It covers base color,
metallic-roughness, normal, occlusion, and emissive texture channels after
normal-map shader support landed.

Reference patterns inspected:

- `references/three.js/examples/jsm/loaders/GLTFLoader.js`
- `references/engine/src/framework/parsers/glb-parser.js`
- `references/bevy/crates/bevy_gltf/src/loader/mod.rs`
- `references/bevy/crates/bevy_pbr/src/pbr_material.rs`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/MATERIAL_TEXTURE_RENDER_STATE_COVERAGE.md`

## Current Alignment

- Base-color textures are represented as `baseColorTexture`, multiply the
  scalar `baseColorFactor`, and can use sRGB texture formats. This matches the
  glTF/three.js pattern of treating base color as color data.
- Metallic-roughness textures are represented as one shared texture and the
  shader reads metallic from B and roughness from G, matching glTF and Bevy.
- Normal textures now participate in shader specialization, bind-group
  planning, app resource preparation, and tangent-gated extraction. This matches
  Bevy's requirement that normal-mapped meshes provide normals, UVs, and
  tangents.
- Occlusion textures read the red channel and apply `occlusionStrength` to the
  ambient term, which is a reasonable direct-lit MVP interpretation of glTF
  occlusion.
- Emissive textures multiply `emissiveFactor`, with tests using sRGB texture
  data for emissive maps.

## Gaps Before GLB Material Mapping

- Texture `texCoord` fields are packed but the shaders always sample
  `input.uv`. glTF material import needs a real UV-set contract before it can
  claim support for non-default UV channels.
- Texture transforms are not represented in `MaterialTextureBinding` yet.
  three.js, PlayCanvas, and Bevy all preserve at least some transform metadata
  from glTF; Aperture should diagnose or preserve it instead of silently losing
  it.
- Texture asset `semantic` and `colorSpace` are explicit, but StandardMaterial
  binding readiness does not yet validate that base/emissive maps are color data
  and metallic-roughness/normal/occlusion maps are data/linear maps.
- GLB import still needs sampler conversion and source-image upload policy. The
  renderer has sampler assets, but no importer-level mapping contract exists.
- Aperture requires authored tangents for normal maps. That is acceptable for
  the current renderer, but GLB import should either preserve tangents, generate
  them in a simulation/package-safe step, or emit a JSON-safe diagnostic.

## Decision

Keep GLB material mapping deferred. The renderer is closer to the glTF
metallic-roughness target, but importing GLB materials now would still risk
pretending unsupported UV channels, texture transforms, sampler conversion, and
color-space rules are rendered correctly.

## Follow-Ups

- Add StandardMaterial texture semantic/color-space readiness diagnostics.
- Add a UV-set handling plan for `MaterialTextureBinding.texCoord`, starting
  with explicit `TEXCOORD_1` diagnostics or shader support.
- Keep alpha-test/transparent queue consumption as a separate render-queue
  follow-up before importing GLB alpha modes.
