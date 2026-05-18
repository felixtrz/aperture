# GLB Alpha-Mask Texture Pixel Fixture Plan - 2026-05-17

## Scope

Plan a narrow GLB-derived browser fixture that proves StandardMaterial
alpha-mask pixel behavior with a base-color texture alpha channel.

This is a planning slice only. It does not implement the browser scenario, add
transparent blending, change queue sorting, or claim binary `.glb` loading.

## References Inspected

- `docs/research/GLB_ALPHA_DOUBLE_SIDED_RENDER_STATE_DIAGNOSTICS_PLAN_2026_05_17.md`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`
- `packages/render/src/materials/gltf-material.ts`
- `packages/webgpu/src/webgpu/standard-shader.ts`
- `packages/webgpu/src/webgpu/standard-pipeline-descriptor.ts`

## Current State

The existing `alpha-mask-double-sided` browser scenario proves source glTF
render-state mapping and pipeline-key diagnostics for:

- `alphaMode: "MASK"`;
- `alphaCutoff: 0.35`;
- `doubleSided: true`;
- mapped `StandardMaterial.renderState.alphaMode: "mask"`;
- mapped `cullMode: "none"`;
- current scalar-material pipeline key `standard|mask|none|less|none`.

That scenario intentionally avoids a texture and does not prove pixel-level
discard behavior.

`STANDARD_MESH_WGSL` already applies alpha masking in the fragment shader. When
`baseColorTexture` is present, alpha is sampled from
`baseColorSample.a * material.baseColorFactor.a` and discarded when it is below
`material.alphaCutoff`.

## Selected Follow-Up Slice

Add `standard-gltf-texture?scenario=alpha-mask-texture`.

Use the existing GLB-shaped source mapping path, not a binary GLB fetch:

```js
{
  asset: { version: "2.0" },
  materials: [
    {
      name: "GLB Standard Alpha Mask Texture",
      alphaMode: "MASK",
      alphaCutoff: 0.5,
      doubleSided: true,
      pbrMetallicRoughness: {
        baseColorFactor: [1, 1, 1, 1],
        baseColorTexture: { index: 0 },
        metallicFactor: 0,
        roughnessFactor: 0.8
      }
    }
  ],
  textures: [{ source: 0, sampler: 0 }],
  images: [{ bufferView: 0, mimeType: "image/png", name: "AlphaMaskBaseColor" }],
  samplers: [nearestClampSampler]
}
```

## Texture Bytes

Use a 2x2 RGBA base-color texture with one side opaque and one side masked out.
Nearest clamp sampling keeps the expected sampled alpha stable:

```text
left pixels:  [24, 128, 255, 255]
right pixels: [255, 24, 24, 64]
```

With `alphaCutoff: 0.5`, the right side's alpha `64 / 255` should be discarded.
The left side should render the blue base-color texture through the existing
StandardMaterial lighting path.

## Expected Status

Publish the same JSON-safe status shapes as existing GLB texture scenarios:

- `standardTexture.textureSlot: "baseColorTexture"`;
- texture key `texture:gltf:texture:0:baseColorTexture`;
- sampler key `sampler:gltf:sampler:0:baseColorTexture`;
- source render-state fields `alphaMode`, `alphaCutoff`, and `doubleSided`;
- mapped render-state fields `alphaMode`, `alphaCutoff`, `cullMode`, `depth`,
  and `blend`;
- expected opaque and masked sample points;
- expected opaque texture color and expected masked clear color;
- pipeline key and mesh layout key;
- draw/resource counters and diagnostics.

Expected pipeline key:

```text
standard|baseColorTexture|mask|none|less|none
```

Expected mesh layout key:

```text
POSITION,NORMAL,TEXCOORD_0
```

## Pixel Assertions

Use two sample points well inside the plane, not on the alpha boundary:

- opaque sample: left side of the textured plane, expected closer to the blue
  texture color than to clear;
- masked sample: right side of the textured plane, expected closer to the clear
  color than to the opaque texture color.

Assert both screenshot pixels and readback samples when readback is available.
The readback should request two sample ids, for example `opaque` and `masked`.
If readback is unavailable, keep the current pattern of asserting a JSON-safe
readback reason/message while relying on screenshot pixels.

## Expected Playwright Assertions

- status is rendered and JSON-safe;
- glTF asset mapping and source registration are valid with one texture, one
  sampler, and one material;
- `standardMaterial.renderState.source` matches the glTF source fields;
- mapped render state is `mask` alpha, no culling, no blending, depth write
  enabled;
- extraction queues one draw with zero diagnostics;
- pipeline key is `standard|baseColorTexture|mask|none|less|none`;
- opaque sample is visibly non-clear;
- masked sample is visibly clear;
- no WebGPU validation warnings are emitted.

## Non-Goals

- No transparent alpha blending.
- No order-independent transparency.
- No multi-object sorting proof.
- No double-sided backface pixel proof.
- No texture-transform sampling.
- No binary `.glb` loading.

## Follow-Up Task

### task-1130 — Add GLB alpha-mask texture pixel fixture

Category: `runtime-orchestration`
Package/write-scope: `examples/standard-gltf-texture.js` and
`test/e2e/standard-gltf-texture.spec.ts`.
Reference anchor:
`docs/research/GLB_ALPHA_MASK_TEXTURE_PIXEL_FIXTURE_PLAN_2026_05_17.md`,
current `alpha-mask-double-sided` browser fixture, and the
`STANDARD_MESH_WGSL` alpha-mask discard path.

Acceptance criteria:

- Add `standard-gltf-texture?scenario=alpha-mask-texture` using a GLB-shaped
  StandardMaterial base-color texture with alpha values above and below
  `alphaCutoff`.
- Browser status reports JSON-safe source/mapped render-state fields, texture
  handles, sampler mapping, expected sample points, pipeline keys, draw/resource
  counters, and diagnostics.
- Playwright asserts one opaque pixel/readback sample and one masked clear
  pixel/readback sample.
- The scenario uses the alpha-test pipeline key without claiming transparent
  blending or binary `.glb` loading.
