---
"@aperture-engine/render": minor
"@aperture-engine/webgpu": minor
---

Apply the base-color texture transform in the unlit material pipeline. The
app-facing `UnlitMaterialOptions.baseColorTexture` docs sanction `transform`
(offset/scale/rotation) as the way to address atlas sub-rects — "point
several materials at one texture and give each a different offset/scale
instead of shipping a texture per tile" — but `packUnlitMaterial` packed only
`baseColorFactor` and the unlit WGSL sampled raw `input.uv`, so every atlas
material silently drew the whole sheet.

The packed unlit uniform grows from 4 to 12 floats (`baseColorFactor`, then
offset.xy / scale.xy, then rotation plus struct padding) and both textured
unlit shader variants transform the UV with the same scale-rotate-translate
order the StandardMaterial `KHR_texture_transform` path uses. Materials
without a transform pack the identity and render exactly as before; no
pipeline key or bind group layout changes, so existing snapshots and render
bundles replay unchanged.
