# GLB Alpha-Mask Backface Visual Fixture Plan - 2026-05-18

## Scope

Plan a narrow browser fixture that visually proves glTF `doubleSided: true`
reaches the WebGPU StandardMaterial no-cull path.

This is a planning slice only. It does not implement the fixture, add
transparent blending, add binary `.glb` loading, or change StandardMaterial
shading.

## References Inspected

- `docs/research/GLB_ALPHA_DOUBLE_SIDED_RENDER_STATE_DIAGNOSTICS_PLAN_2026_05_17.md`
- `docs/research/GLB_ALPHA_MASK_TEXTURE_PIXEL_FIXTURE_PLAN_2026_05_17.md`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`
- `packages/render/src/materials/gltf-material.ts`
- `packages/webgpu/src/webgpu/standard-pipeline-descriptor.ts`
- `packages/webgpu/src/webgpu/standard-pipeline.ts`

## Current State

`standard-gltf-texture?scenario=alpha-mask-double-sided` already proves the
source-to-status path:

- glTF `alphaMode: "MASK"`;
- glTF `doubleSided: true`;
- mapped `StandardMaterial.renderState.alphaMode: "mask"`;
- mapped `cullMode: "none"`;
- scalar StandardMaterial pipeline key `standard|mask|none|less|none`.

`standard-gltf-texture?scenario=alpha-mask-texture` proves textured alpha-mask
discard with one opaque sample and one clear masked sample. It does not isolate
backface visibility because the primitive remains front-facing.

## Selected Fixture Shape

Add `standard-gltf-texture?scenario=alpha-mask-backface`.

Use a scalar masked StandardMaterial, not the alpha-mask texture fixture. This
keeps the visual proof focused on culling:

```js
{
  asset: { version: "2.0" },
  materials: [
    {
      name: "GLB Standard Alpha Mask Backface",
      alphaMode: "MASK",
      alphaCutoff: 0.35,
      doubleSided: true,
      pbrMetallicRoughness: {
        baseColorFactor: [0.95, 0.1, 0.08, 1],
        metallicFactor: 0,
        roughnessFactor: 0.8
      }
    }
  ]
}
```

Use a single plane primitive that is intentionally back-facing from the camera.
The least invasive implementation is to reuse the current plane mesh fixture
and apply a 180 degree Y-axis rotation to the renderable entity, keeping the
camera and lights unchanged. If that rotation makes sample placement unstable,
use a tiny helper mesh with the same vertices and reversed triangle winding.

## Expected Status

Publish the same JSON-safe render-state fields as the existing
`alpha-mask-double-sided` scenario:

- source `alphaMode`, `alphaCutoff`, and `doubleSided`;
- mapped `alphaMode`, `alphaCutoff`, `cullMode`, `depth`, and `blend`;
- pipeline key `standard|mask|none|less|none`;
- mesh layout key `POSITION,NORMAL`;
- sample point near the center of the plane;
- expected visible scalar color;
- draw/resource counters and diagnostics.

Do not publish GPU pipelines, bind groups, backend caches, command encoders, or
raw WebGPU handles.

## Pixel Assertion

Sample the center of the back-facing plane. With `doubleSided: true` mapped to
`cullMode: "none"`, the pixel should be closer to the scalar material color than
to the clear color.

The test should assert both screenshot and readback samples when readback is
available, following the current alpha-mask texture fixture pattern. If readback
is unavailable, keep the existing JSON-safe readback reason/message assertion
and rely on screenshot pixels.

## Expected Playwright Assertions

- status is rendered and JSON-safe;
- glTF asset mapping and source registration are valid with zero texture and
  sampler assets;
- mapped render state is mask alpha, no culling, no blending, depth write
  enabled;
- extraction queues one draw with zero diagnostics;
- pipeline key is `standard|mask|none|less|none`;
- mesh layout key is `POSITION,NORMAL`;
- center backface pixel is non-clear and closer to the scalar material color
  than to the clear color;
- no WebGPU validation warnings are emitted.

## Non-Goals

- No transparent alpha blending.
- No multi-object sorting or order-independent transparency.
- No textured alpha discard assertion; the existing alpha-mask texture fixture
  already covers that.
- No binary `.glb` fetch/loading path.
- No generalized two-sided lighting model beyond proving no-cull rasterization.

## Follow-Up Task

### task-1137 — Add GLB alpha-mask backface visual fixture

Category: `runtime-orchestration`
Package/write-scope: `examples/standard-gltf-texture.js` and
`test/e2e/standard-gltf-texture.spec.ts`.
Reference anchor:
`docs/research/GLB_ALPHA_MASK_BACKFACE_VISUAL_FIXTURE_PLAN_2026_05_18.md`,
the existing `alpha-mask-double-sided` render-state fixture, and the current
alpha-mask texture pixel fixture.

Acceptance criteria:

- Add `standard-gltf-texture?scenario=alpha-mask-backface` using a GLB-shaped
  scalar StandardMaterial with `alphaMode: "MASK"` and `doubleSided: true`.
- Render a back-facing plane through ECS-authored mesh/material components.
- Browser status reports JSON-safe source/mapped render-state fields, expected
  sample point, pipeline key, mesh layout key, draw/resource counters, and
  diagnostics.
- Playwright asserts the sampled backface pixel is visible/non-clear and the
  pipeline key uses alpha-test with no culling.
- The scenario does not claim transparent blending, binary `.glb` loading, or
  generalized two-sided lighting.
