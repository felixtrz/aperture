# GLB Metallic-Roughness Texture Browser Fixture Plan - 2026-05-17

## Scope

Plan the smallest GLB-derived browser fixture for
`StandardMaterial.metallicRoughnessTexture`.

This is a planning slice. It does not implement the browser scenario, add full
glTF PBR, add IBL, shadows, UV1, texture transforms, or a binary GLB loader.

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/GLB_STANDARD_TEXTURE_BROWSER_FIXTURE_PLAN_2026_05_17.md`
- `docs/research/GLB_TEXTURE_BROWSER_UPLOAD_USAGE_BOUNDARY_AUDIT_2026_05_17.md`
- `examples/standard-gltf-texture.js`
- `examples/standard-texture-control.js`
- `test/e2e/standard-gltf-texture.spec.ts`
- `test/e2e/standard-texture-control.spec.ts`
- `packages/render/src/materials/gltf-material.ts`
- `packages/render/src/materials/gltf-texture.ts`

## Current State

The authored controlled browser harness already proves
`metallicRoughnessTexture` affects StandardMaterial pixels under controlled
lighting.

The GLB-derived browser harness proves base-color texture handoff through:

1. glTF material/texture/sampler mapping;
2. source asset registration;
3. ECS mesh/material handle authoring;
4. normal app-facade extraction/rendering;
5. JSON-safe status and optional readback samples.

The next GLB slot should reuse that path instead of creating a parallel loader
or renderer route.

## Selected Fixture

Add `standard-gltf-texture?scenario=metallic-roughness`.

Use the existing inline GLB-equivalent root but change the material to:

- `pbrMetallicRoughness.baseColorFactor`: a fixed scalar color, matching the
  authored metallic-roughness controlled scenario.
- `pbrMetallicRoughness.metallicFactor`: `1`.
- `pbrMetallicRoughness.roughnessFactor`: `1`.
- `pbrMetallicRoughness.metallicRoughnessTexture.index`: `0`.

Use one 2x2 data texture:

- format/color-space from the glTF texture mapper should become
  `rgba8unorm` / `data`;
- green channel encodes roughness;
- blue channel encodes metallic;
- use nearest clamp sampler settings to isolate slot mapping.

Use the same plane mesh, camera, and direct-lit/ambient lighting shape as the
authored metallic-roughness browser proof unless a first implementation reveals
the GLB fixture needs a slightly different fixed light angle for stable pixel
contrast.

## Expected Status Fields

Publish JSON-safe fields for:

- scenario id;
- `gltf.assetMapping` counts and diagnostic codes;
- source registration stage summaries;
- material/texture/sampler/mesh handle keys;
- `standardTexture.textureSlot: "metallicRoughnessTexture"`;
- expected metallic/roughness channel values;
- expected pipeline key;
- mesh layout key;
- resource counters;
- draw counts;
- optional readback samples.

Do not publish raw texture bytes, GLB binary chunks, GPU resources, backend
cache maps, queues, encoders, or WebGPU handles.

## Expected Browser Assertions

The Playwright scenario should assert:

- status is rendered and JSON-safe;
- asset mapping is valid with one material, one texture, and one sampler;
- registration writes material, texture, sampler, and mesh source assets;
- extraction has one view, one mesh draw, two lights, and zero diagnostics;
- pipeline key contains `standard|metallicRoughnessTexture|opaque|back|less|none`;
- resource counters include one texture, one sampler, and one material buffer;
- screenshot/readback samples differ from clear and from a stable scalar
  comparison or expected direction.

Prefer adding a scalar comparison entity only if a single GLB-derived entity
cannot produce a stable pixel assertion. If a comparison is needed, keep it
ECS-authored and source-asset based.

## Non-Goals

- No IBL, shadows, environment maps, or physically complete PBR claim.
- No UV1, texture transform, normal-map tangent, occlusion, or emissive GLB
  scenarios in this slice.
- No binary GLB parser/browser fetch path.
- No generic material queue migration.

## Follow-Up Task

### task-1111 - Add GLB StandardMaterial metallic-roughness texture browser fixture

Category: `runtime-orchestration`
Package/write-scope: `examples/standard-gltf-texture.js`,
`test/e2e/standard-gltf-texture.spec.ts`, and targeted docs if tracker status
changes.
Reference anchor:
`docs/research/GLB_METALLIC_ROUGHNESS_TEXTURE_BROWSER_FIXTURE_PLAN_2026_05_17.md`,
the GLB base-color browser fixture, and the authored metallic-roughness
controlled browser scenario.

Acceptance criteria:

- Add `standard-gltf-texture?scenario=metallic-roughness` using glTF mapping and
  source registration for a `metallicRoughnessTexture`.
- Browser status reports JSON-safe GLB mapping, slot expectations, source asset
  keys, pipeline/resource counters, diagnostics, draw counts, and readback
  samples when available.
- Playwright verifies the mapped GLB-derived metallic-roughness texture renders
  through the app-facade path without claiming IBL, shadows, UV1, transforms, or
  full glTF PBR fidelity.
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts -g "metallic-roughness"`
  and `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts` pass.
