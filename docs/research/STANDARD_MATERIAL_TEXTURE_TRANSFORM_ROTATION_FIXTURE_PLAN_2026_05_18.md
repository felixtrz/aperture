# StandardMaterial Texture-Transform Rotation Fixture Plan

Date: 2026-05-18

## Scope

Plan the smallest future browser fixture for `KHR_texture_transform.rotation`
on a StandardMaterial base-color texture. This is a planning note only; current
runtime behavior should continue diagnosing rotation as unsupported until the
implementation task lands.

## References Inspected

- Khronos `KHR_texture_transform` extension README:
  `https://github.com/KhronosGroup/glTF/blob/main/extensions/2.0/Khronos/KHR_texture_transform/README.md`
- `docs/research/GLB_TEXTURE_TRANSFORM_SAMPLING_FIXTURE_PLAN_2026_05_18.md`
- `docs/research/STANDARD_MATERIAL_TEXTURE_TRANSFORM_SUPPORT_AUDIT_2026_05_18.md`
- `packages/render/src/materials/gltf-material.ts`
- `packages/render/src/materials/standard-texture-readiness.ts`
- `packages/webgpu/src/webgpu/standard-material-buffer.ts`
- `packages/webgpu/src/webgpu/standard-shader.ts`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`

## Spec Shape To Preserve

The Khronos extension defines texture transforms as an affine UV transform with
translation, rotation, and scale. The README's GLSL example composes:

```text
matrix = translation * rotation * scale
uvTransformed = (matrix * vec3(uv, 1)).xy
```

Rotation is in radians counter-clockwise around the UV origin. The fixture
should verify that ordering instead of merely proving that some offset happened.

## Selected Fixture

Scenario name:

```text
base-color-transform-rotation-sampling
```

Use a custom GLB-shaped plane mesh whose screen-center sample interpolates to a
known UV:

```text
authored UV0 at sample: [0.25, 0.25]
```

Use a nearest-filtered 4x4 base-color texture with unique, high-contrast colors
for at least these coordinates:

```text
untransformed:          [0.25, 0.25]
offset-scale-only:      [0.75, 0.75]
rotation-then-offset:   [0.25, 0.75]
```

Use the transform:

```text
offset:   [0.5, 0.5]
rotation: 1.5707963267948966
scale:    [1, 1]
```

With the Khronos matrix order:

```text
rotate90([0.25, 0.25]) + [0.5, 0.5] = [0.25, 0.75]
```

This distinguishes rotation from the current offset/scale helper:

```text
[0.25, 0.25] * [1, 1] + [0.5, 0.5] = [0.75, 0.75]
```

It also distinguishes both transformed paths from untransformed sampling:

```text
[0.25, 0.25]
```

All three comparison UVs stay inside `[0, 1]`, avoiding sampler wrap/clamp
ambiguity.

## Implementation Changes Needed

Keep support narrow:

- Continue supporting transforms only for `baseColorTexture` on `TEXCOORD_0`.
- Update `gltf-material.ts` and `standard-texture-readiness.ts` support
  predicates to accept finite rotation for base-color UV0 only.
- Keep transformed UV1 and transformed non-base-color slots unsupported.
- Reuse one existing StandardMaterial uniform padding float for
  `baseColorTextureRotation` if layout/alignment checks confirm it remains
  stable; otherwise grow the uniform intentionally and update layout tests.
- Update `packStandardMaterial()` to pack rotation with default `0`.
- Change WGSL `standardTextureTransformUv()` from offset/scale only to
  scale-then-rotate-then-offset.
- Keep texture transform math in the shader helper, not in ECS authoring state
  or app orchestration.

## Browser Assertions

The Playwright test should assert:

- mapping diagnostics do not include
  `gltfMaterial.unsupportedTextureTransform`
- render diagnostics do not include
  `render.standardMaterialTexture.unsupportedTextureTransform`
- readiness has one ready `baseColorTexture` slot on texcoord `0`
- pipeline key remains the base-color textured StandardMaterial key
- mesh layout does not need `TEXCOORD_1`
- screenshot/readback color is closer to the rotated expected color than both
  the offset-scale-only and untransformed colors
- status JSON does not expose raw GPU handles, source texture payload bytes, or
  sampler objects

## Non-Goals

- Do not add transformed UV1 support in the same task.
- Do not add rotation for metallic-roughness, normal, occlusion, or emissive
  slots.
- Do not change binary GLB loading claims; this remains a GLB-shaped browser
  fixture.

## Follow-Up Task

### task-1161 — Implement base-color texture-transform rotation sampling

Category: `webgpu-render`
Package/write-scope: `packages/render/src/materials`,
`packages/webgpu/src/webgpu`, `examples/standard-gltf-texture.js`, and
`test/e2e/standard-gltf-texture.spec.ts`.
Reference anchor: this plan, the Khronos `KHR_texture_transform` README,
`packages/webgpu/src/webgpu/standard-shader.ts`, and the current
`base-color-transform-sampling` fixture.

Acceptance criteria:

- StandardMaterial base-color texture transforms support rotation on
  `TEXCOORD_0` without expanding support to transformed UV1 or non-base-color
  slots.
- Uniform packing and WGSL implement scale, rotation, then offset in the
  Khronos order.
- A browser fixture proves rotated sampling is closer to the rotated expected
  texel than offset/scale-only or untransformed texels.
- Existing unsupported transform diagnostics remain for transformed UV1 and
  transformed non-base-color slots.
