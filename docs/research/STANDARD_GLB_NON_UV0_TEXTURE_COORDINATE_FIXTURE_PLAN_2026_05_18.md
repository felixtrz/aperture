# Standard GLB Non-UV0 Texture-Coordinate Fixture Plan

Date: 2026-05-18

## Scope

Plan the smallest `standard-gltf-texture` browser fixture that proves glTF
`texCoord: 1` behavior honestly for `StandardMaterial` without expanding GLB
mesh import scope or mixing it with texture-transform work.

## References Inspected

- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`
- `examples/standard-texture-control.js`
- `test/e2e/standard-texture-control.spec.ts`
- `packages/render/src/materials/gltf-material.ts`
- `packages/render/src/rendering/extraction.ts`
- `packages/webgpu/src/webgpu/standard-shader.ts`
- `packages/webgpu/src/webgpu/standard-pipeline-descriptor.ts`
- `docs/research/CONTROLLED_STANDARD_UV1_BROWSER_VERIFICATION_PLAN_2026_05_17.md`

## Current State

The engine already supports the core non-UV0 path:

- `StandardMaterial` texture readiness accepts `texCoord: 1` for rendered
  texture slots and diagnoses higher unsupported UV sets.
- Render extraction blocks `TEXCOORD_1` materials when the mesh lacks a
  `TEXCOORD_1` vertex attribute.
- Pipeline keys include `uv1` when a StandardMaterial texture binding uses
  `texCoord: 1`.
- StandardMaterial WGSL variants add a `uv1` vertex input and sample through
  `standardTextureUv(material.<field>TexCoord, input.uv, input.uv1)`.
- `standard-texture-control?scenario=base-color-uv1` already verifies the
  positive browser sampling path outside the GLB-shaped fixture.

The current `standard-gltf-texture` fixture does not exercise glTF-authored
`texCoord: 1`.

## Smallest GLB-Shaped Fixture

Add a `standard-gltf-texture` scenario named:

```text
base-color-uv1
```

The fixture should stay local to `examples/standard-gltf-texture.js`:

- Keep the existing glTF-shaped material mapping path.
- Author `pbrMetallicRoughness.baseColorTexture` as `{ index: 0, texCoord: 1 }`.
- Reuse the current 2x2 nearest sampled texture pattern or a two-color variant
  where UV0 and UV1 select different texels at the same screen sample.
- Add a local helper equivalent to the existing
  `standard-texture-control.js` UV1 mesh helper: copy the plane vertex stream,
  append a `TEXCOORD_1` `float32x2` attribute, and fill all vertices with a
  deterministic UV1 coordinate.
- Do not claim binary `.glb` mesh import supports `TEXCOORD_1`; this browser
  fixture still uses report-driven source asset registration and a manually
  constructed mesh asset.

## Assertions

The browser test should assert:

- `status.scenario === "base-color-uv1"`.
- Material mapping is valid and records one base-color texture and sampler.
- `standardTexture.readiness.ready === true`.
- The material texture readiness slot for `baseColorTexture` has `texCoord: 1`.
- Pipeline keys include
  `standard|baseColorTexture|uv1|opaque|back|less|none`.
- Mesh layout keys include `POSITION,NORMAL,TEXCOORD_0,TEXCOORD_1`.
- Screenshot/readback pixels match the UV1-selected texel and are farther from
  the UV0-selected texel.
- Status remains JSON-safe and does not expose raw GPU resources or source
  texture payload bytes.

## Deferred Negative Fixture

A missing-`TEXCOORD_1` GLB browser scenario is useful but not the smallest next
step. Unit extraction tests already cover this diagnostic path. Add the
browser-negative variant only after the positive GLB-shaped UV1 fixture lands or
if a real browser regression appears.

## Follow-Up Task

### task-1153 — Add standard GLB base-color UV1 browser fixture

Category: `runtime-orchestration`
Package/write-scope: `examples/standard-gltf-texture.js` and
`test/e2e/standard-gltf-texture.spec.ts`.
Reference anchor: this plan, `examples/standard-texture-control.js`,
`test/e2e/standard-texture-control.spec.ts`,
`packages/render/src/rendering/extraction.ts`, and
`packages/webgpu/src/webgpu/standard-shader.ts`.

Acceptance criteria:

- `standard-gltf-texture?scenario=base-color-uv1` authors glTF
  `baseColorTexture.texCoord = 1` and a mesh with `TEXCOORD_1`.
- Browser status reports readiness for `baseColorTexture` with `texCoord: 1`.
- Playwright asserts the UV1 pipeline key, UV1 mesh layout key, JSON-safe
  status, and UV1-selected pixel/readback color.
- The fixture does not imply binary GLB mesh import supports `TEXCOORD_1`.
