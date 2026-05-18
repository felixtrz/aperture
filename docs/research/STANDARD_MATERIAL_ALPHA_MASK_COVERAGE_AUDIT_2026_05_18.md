# StandardMaterial Alpha-Mask Coverage Audit - 2026-05-18

## Scope

Audit current StandardMaterial alpha-mask coverage after the GLB render-state,
shader, buffer, desktop pixel, and narrow viewport slices.

This audit did not change runtime behavior. It checks for coverage gaps,
overclaims, and small follow-up work.

## References Inspected

- `docs/research/GLB_ALPHA_MASK_TEXTURE_PIXEL_FIXTURE_PLAN_2026_05_17.md`
- `docs/research/GLB_ALPHA_MASK_BACKFACE_VISUAL_FIXTURE_PLAN_2026_05_18.md`
- `packages/render/src/materials/gltf-material.ts`
- `packages/render/src/materials/pipeline-key.ts`
- `packages/webgpu/src/webgpu/standard-shader.ts`
- `packages/webgpu/src/webgpu/standard-material-buffer.ts`
- `test/assets/gltf-asset-mapping.test.ts`
- `test/webgpu/standard-shader.test.ts`
- `test/webgpu/standard-material-buffer.test.ts`
- `test/e2e/standard-gltf-texture.spec.ts`

## Findings

Alpha-mask coverage is now aligned across the current StandardMaterial path:

- glTF source mapping: `test/assets/gltf-asset-mapping.test.ts` verifies
  `alphaMode: "MASK"`, default/explicit `alphaCutoff`, `BLEND`, and
  `doubleSided` mapping into `StandardMaterial.renderState`.
- Pipeline key: `test/webgpu/standard-shader.test.ts` locks the textured masked
  key `standard|baseColorTexture|mask|none|less|none`; the browser scenarios
  assert both scalar `standard|mask|none|less|none` and textured alpha-mask
  pipeline keys.
- Buffer packing: `test/webgpu/standard-material-buffer.test.ts` covers scalar
  and textured masked materials, including `ALPHA_MASK`, `DOUBLE_SIDED`,
  `alphaCutoff`, and base-color texture/sampler dependency keys.
- WGSL discard: `test/webgpu/standard-shader.test.ts` verifies the textured
  variant derives alpha from sampled base-color alpha multiplied by
  `baseColorFactor.a`, compares against `material.alphaCutoff`, and discards
  after the alpha computation.
- Desktop browser pixels: `standard-gltf-texture?scenario=alpha-mask-texture`
  verifies an opaque sample is non-clear and a masked sample is clear.
- Narrow viewport pixels: the mobile/narrow Playwright case repeats the
  alpha-mask texture pixel assertions at a smaller viewport.
- JSON safety: browser assertions continue to run through
  `expectStatusJsonSafeForGpu`, and published status uses handle keys and
  plain diagnostics rather than WebGPU objects.

## Boundaries Preserved

The current alpha-mask tests do not claim:

- transparent alpha blending;
- binary `.glb` loading;
- multi-object transparency sorting;
- order-independent transparency;
- a generalized two-sided lighting model.

The fixture remains GLB-shaped source mapping over Aperture source assets and
ECS-authored mesh/material handles.

## Gaps

The remaining concrete alpha/double-sided gap is visual backface proof. The
existing `alpha-mask-double-sided` case proves status and pipeline no-cull
mapping; the existing `alpha-mask-texture` case proves textured discard. Neither
isolates a back-facing primitive that would disappear under back-face culling.

That gap is now planned in
`docs/research/GLB_ALPHA_MASK_BACKFACE_VISUAL_FIXTURE_PLAN_2026_05_18.md`.

There is also repeated status/test helper logic in
`examples/standard-gltf-texture.js` and `test/e2e/standard-gltf-texture.spec.ts`
as GLB scenarios accumulate. It is not blocking correctness, but a later cleanup
could extract scenario status builders or expectation helpers once the next
fixture lands.

## Follow-Up

- Implement `task-1137` to add the back-facing alpha-mask browser fixture.
- Consider a small helper cleanup after `task-1137` if another GLB browser
  scenario is added; avoid extracting helpers before the fixture shape settles.
