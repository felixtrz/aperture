# GLB Texture-Transform Sampling Fixture Plan

Date: 2026-05-18

## Scope

Plan the smallest future browser fixture that turns the existing
`KHR_texture_transform` diagnostics into actual sampled UV behavior for
`StandardMaterial` base-color textures. This is a planning note only; it does
not change shader behavior or the current expected-failure fixture.

## References Inspected

- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`
- `packages/render/src/materials/gltf-material.ts`
- `packages/webgpu/src/webgpu/standard-shader.ts`

## Current State

The `base-color-transform` scenario already creates a glTF-shaped
`pbrMetallicRoughness.baseColorTexture` with a `KHR_texture_transform` offset.
The mapping layer parses the extension into `MaterialTextureTransform` and emits
`gltfMaterial.unsupportedTextureTransform`. The browser status then expects
`render.standardMaterialTexture.unsupportedTextureTransform` and does not submit
draws.

The current StandardMaterial shader stores per-slot texCoord indices in
`StandardMaterialUniform`, but it samples `input.uv` directly for base-color,
metallic-roughness, normal, occlusion, and emissive texture variants. There is no
uniform storage for offset, scale, rotation, or transformed UV output yet.

## Smallest Future Fixture

Add a new scenario after shader support exists, leaving the current
`base-color-transform` diagnostic fixture intact until then.

Suggested scenario name:

```text
base-color-transform-sampling
```

Use a 2x2 nearest-filtered base-color texture with four distinct colors:

```text
top-left:     red
top-right:    green
bottom-left:  blue
bottom-right: white
```

Use the same quad/cube face and sample point as the ready base-color fixture:

```text
screen sample: { id: "textured", x: 0.5, y: 0.5 }
authored UV: approximately the current center-face UV
transform: { offset: [0.25, 0], scale: [0.5, 1], rotation: 0 }
```

The chosen texture should make transformed and untransformed sampling land on
different texels. The Playwright assertion should compare readback against the
transformed texel and also assert that it does not match the untransformed texel
or clear color.

## Source Material Fields

The source glTF material should keep the transform on:

```text
pbrMetallicRoughness.baseColorTexture.extensions.KHR_texture_transform
```

The resolver should preserve:

- `texture.index`
- `texCoord`
- `transform.offset`
- `transform.scale`
- `transform.rotation` only when non-zero in a later rotation fixture

The initial implementation should support offset and scale for UV0 only. If
rotation is not implemented in the first slice, mapping diagnostics should stay
honest and continue reporting rotation as unsupported.

## WGSL Implications

Add a compact per-material texture-transform representation before broadening
the fixture:

- Extend StandardMaterial prepared data with base-color texture transform
  values.
- Pack offset and scale into existing or adjacent StandardMaterial uniform
  fields without changing ECS authoring state.
- Add a shader helper equivalent to:

```wgsl
fn transformUv(uv: vec2f, offset: vec2f, scale: vec2f) -> vec2f {
  return uv * scale + offset;
}
```

- Use transformed UVs only for slots whose transform is supported.
- Keep unsupported transform diagnostics JSON-safe and slot-specific.

Rotation should be a follow-up because glTF rotates around the origin in texture
space and needs a fixture that distinguishes rotation from offset/scale without
ambiguous texel selection.

## Browser Assertions

The Playwright fixture should assert:

- glTF asset mapping is valid or has no transform diagnostic for supported
  offset/scale.
- render diagnostics do not include
  `render.standardMaterialTexture.unsupportedTextureTransform`.
- pipeline key still reflects `standard|baseColorTexture|...`.
- texture and sampler resources are created once.
- readback sample matches the transformed texel within the existing tolerance.
- status JSON does not expose raw GPU handles, source texture payload bytes, or
  sampler objects.

## Follow-Up Task

### task-1148 — Implement base-color texture transform offset/scale sampling

Category: `webgpu-render`
Package/write-scope: `packages/render/src/materials`,
`packages/webgpu/src/webgpu`, `examples/standard-gltf-texture.js`, and
`test/e2e/standard-gltf-texture.spec.ts`.
Reference anchor: this plan, current `base-color-transform` fixture,
`packages/render/src/materials/gltf-material.ts`, and
`packages/webgpu/src/webgpu/standard-shader.ts`.

Acceptance criteria:

- StandardMaterial base-color texture transforms support offset and scale for
  UV0 without making ECS own renderer state.
- Unsupported transform diagnostics remain for unsupported rotation or non-UV0
  cases.
- A browser fixture verifies transformed base-color sampling with readback.
- Existing `base-color-transform` diagnostic coverage is either updated to the
  unsupported case that remains true or replaced by a clearly named unsupported
  rotation fixture.
