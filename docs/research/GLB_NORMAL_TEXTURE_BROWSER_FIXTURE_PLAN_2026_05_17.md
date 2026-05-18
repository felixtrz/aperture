# GLB Normal Texture Browser Fixture Plan

Date: 2026-05-17

## Scope

Plan the smallest GLB-derived browser fixture for
`StandardMaterial.normalTexture`.

This is a planning slice. It does not implement the scenario, add tangent
generation, add full glTF loading, add normal-map compression formats, or change
the renderer's tangent requirements.

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/research/GLB_METALLIC_ROUGHNESS_TEXTURE_BROWSER_FIXTURE_PLAN_2026_05_17.md`
- `examples/standard-gltf-texture.js`
- `examples/standard-texture-control.js`
- `test/e2e/standard-gltf-texture.spec.ts`
- `test/e2e/standard-texture-control.spec.ts`

## Current State

The authored controlled browser harness already proves normal maps change
StandardMaterial pixels when tangents are present and reports
`render.standardNormalMap.missingTangents` when tangents are absent.

The GLB-derived browser harness now proves base-color and metallic-roughness
texture handoff through glTF mapping, source registration, ECS authoring,
snapshot extraction, WebGPU rendering, JSON-safe diagnostics, and optional
readback samples.

## Selected Fixture

Add `standard-gltf-texture?scenario=normal-map`.

Use the existing inline GLB-equivalent root but change the material to:

- `pbrMetallicRoughness.baseColorFactor`: fixed scalar color;
- `pbrMetallicRoughness.metallicFactor`: `0`;
- `pbrMetallicRoughness.roughnessFactor`: `0.8`;
- `normalTexture.index`: `0`;
- `normalTexture.scale`: `2`.

Use one 2x2 data texture matching the authored normal-map proof:

- bytes: `[128, 128, 16, 255]` repeated across the 2x2 texture;
- texture mapper slot should produce `rgba8unorm` / `linear`;
- nearest clamp sampler settings.

Mesh requirement:

- Use a local plane mesh fixture with tangents, equivalent to the authored
  controlled normal-map scenario.
- Do not add automatic tangent generation in this slice.

Lighting:

- Reuse the authored normal-map light orientation if needed for stable pixel
  contrast.
- Keep the fixture honest: this proves mapped GLB normal texture handoff, not
  complete glTF lighting fidelity.

## Expected Status Fields

Publish JSON-safe fields for:

- scenario id;
- `standardTexture.textureSlot: "normalTexture"`;
- expected normal-map vector and normal scale;
- mapped sampler source/enums and source asset fields;
- mesh/material/texture/sampler handle keys;
- asset mapping and source registration counts;
- pipeline key `standard|normalTexture|opaque|back|less|none`;
- resource counters, draw counts, diagnostics, and optional readback samples.

Do not publish raw texture bytes, GPU resources, backend cache maps, queues, or
WebGPU handles.

## Expected Browser Assertions

The Playwright scenario should assert:

- status is rendered and JSON-safe;
- asset mapping is valid with one material, one texture, and one sampler;
- registration writes material, texture, sampler, and mesh source assets;
- extraction has one view, one mesh draw, two lights, and zero diagnostics;
- pipeline key contains `standard|normalTexture|opaque|back|less|none`;
- mesh layout includes tangents;
- resource counters include one texture, one sampler, and one material buffer;
- screenshot/readback samples differ from clear by a stable threshold.

If the GLB fixture cannot produce stable contrast with one entity, add a scalar
comparison entity through the same ECS/source-asset path rather than special
renderer hooks.

## Non-Goals

- No automatic tangent generation.
- No missing-tangent GLB diagnostic scenario in the first slice; add it only if
  the positive normal-map scenario lands cleanly.
- No UV1, texture transforms, occlusion, emissive, IBL, or shadows.
- No binary `.glb` loader/browser fetch path.

## Follow-Up Task

### task-1115 — Add GLB StandardMaterial normal texture browser fixture

Category: `runtime-orchestration`
Package/write-scope: `examples/standard-gltf-texture.js`,
`test/e2e/standard-gltf-texture.spec.ts`, and targeted docs if tracker status
changes.
Reference anchor:
`docs/research/GLB_NORMAL_TEXTURE_BROWSER_FIXTURE_PLAN_2026_05_17.md`, the GLB
base-color/metallic-roughness browser fixtures, and the authored normal-map
controlled browser scenario.

Acceptance criteria:

- Add `standard-gltf-texture?scenario=normal-map` using glTF mapping and source
  registration for a `normalTexture`.
- Use a local tangent-bearing mesh fixture; do not add automatic tangent
  generation.
- Browser status reports JSON-safe GLB mapping, normal expectations, source
  asset keys, pipeline/resource counters, diagnostics, draw counts, and readback
  samples when available.
- Playwright verifies the mapped GLB-derived normal texture renders through the
  app-facade path without claiming full glTF PBR fidelity.
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts -g "normal"`
  and `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts` pass.
