# GLB Occlusion/Emissive Browser Fixture Split Plan

Date: 2026-05-17

## Scope

Plan how to add GLB-derived browser coverage for
`StandardMaterial.occlusionTexture` and `StandardMaterial.emissiveTexture`
without overloading one fixture or overstating glTF PBR support.

This is a planning slice. It does not implement either scenario, add IBL,
shadows, AO lighting models, texture transforms, UV1 handling, or binary GLB
loading.

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/research/GLB_NORMAL_TEXTURE_BROWSER_FIXTURE_PLAN_2026_05_17.md`
- `examples/standard-gltf-texture.js`
- `examples/standard-texture-control.js`
- `test/e2e/standard-gltf-texture.spec.ts`
- `test/e2e/standard-texture-control.spec.ts`

## Current State

The authored controlled browser harness already proves:

- occlusion texture red-channel data darkens a StandardMaterial result;
- emissive texture and emissive factor brighten a StandardMaterial result;
- browser status can publish JSON-safe slot expectations and readback samples.

The GLB browser harness now covers:

- base-color texture handoff;
- metallic-roughness texture handoff;
- sampler source/mapped status;
- texture-transform diagnostics before draw submission.

## Split Decision

Use two separate implementation tasks.

Reasons:

- Occlusion and emissive have different visual assertions: occlusion needs a
  darker-than-scalar comparison or stable non-clear sample, while emissive needs
  a brighter-than-scalar comparison.
- Emissive uses both `emissiveTexture` and `emissiveFactor`, so its status shape
  should explicitly cover factor/color composition.
- Keeping them separate limits browser fixture branching and makes failures
  easier to diagnose.

## Occlusion Fixture

Scenario: `standard-gltf-texture?scenario=occlusion`.

Material shape:

- `pbrMetallicRoughness.baseColorFactor`: fixed scalar color;
- `pbrMetallicRoughness.metallicFactor`: `0`;
- `pbrMetallicRoughness.roughnessFactor`: `0.8`;
- `occlusionTexture.index`: `0`;
- `occlusionTexture.strength`: `1`.

Texture data:

- 2x2 `rgba8unorm` / `data` texture;
- red channel set to `32 / 255`, other channels can stay `1`;
- nearest clamp sampler.

Expected status:

- `standardTexture.textureSlot: "occlusionTexture"`;
- `expectedOcclusion: { red: 32 / 255, strength: 1 }`;
- mapped sampler status and source asset keys;
- pipeline key `standard|occlusionTexture|opaque|back|less|none`;
- draw/resource counters and optional readback samples.

Pixel strategy:

- Prefer a scalar comparison entity if one-entity contrast is unstable.
- If adding a scalar comparison entity, keep it ECS-authored with source assets
  and use the existing readback sample pair pattern.

## Emissive Fixture

Scenario: `standard-gltf-texture?scenario=emissive`.

Material shape:

- `pbrMetallicRoughness.baseColorFactor`: fixed scalar color;
- `pbrMetallicRoughness.metallicFactor`: `0`;
- `pbrMetallicRoughness.roughnessFactor`: `0.8`;
- `emissiveFactor`: `[0.9, 0.25, 0.08]`;
- `emissiveTexture.index`: `0`.

Texture data:

- 2x2 `rgba8unorm-srgb` / `srgb` texture;
- color `[1, 0.5, 0.125, 1]`;
- nearest clamp sampler.

Expected status:

- `standardTexture.textureSlot: "emissiveTexture"`;
- `expectedEmissive: { factor: [0.9, 0.25, 0.08], color: [1, 0.5, 0.125, 1] }`;
- mapped sampler status and source asset keys;
- pipeline key `standard|emissiveTexture|opaque|back|less|none`;
- draw/resource counters and optional readback samples.

Pixel strategy:

- Prefer a scalar comparison entity and assert emissive is brighter by luminance.
- Avoid claiming physically complete emission or tone mapping behavior.

## Non-Goals

- No combined occlusion+emissive material fixture in the first pass.
- No UV1, texture transform, IBL, shadows, or binary GLB loader.
- No public helper API extraction; keep GLB browser helpers local until the
  scenario matrix stabilizes.

## Follow-Up Tasks

### task-1119 — Add GLB StandardMaterial occlusion texture browser fixture

Category: `runtime-orchestration`
Package/write-scope: `examples/standard-gltf-texture.js`,
`test/e2e/standard-gltf-texture.spec.ts`, and tracker docs if status changes.
Reference anchor:
`docs/research/GLB_OCCLUSION_EMISSIVE_BROWSER_FIXTURE_SPLIT_PLAN_2026_05_17.md`,
the GLB base-color/metallic-roughness fixtures, and the authored occlusion
controlled browser scenario.

Acceptance criteria:

- Add `standard-gltf-texture?scenario=occlusion` using glTF mapping and source
  registration for an `occlusionTexture`.
- Browser status reports JSON-safe occlusion expectations, source asset keys,
  pipeline/resource counters, diagnostics, draw counts, and readback samples
  when available.
- Playwright verifies the mapped GLB-derived occlusion texture renders through
  the app-facade path without claiming full ambient-occlusion lighting fidelity.
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts -g "occlusion"`
  and `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts` pass.

### task-1120 — Add GLB StandardMaterial emissive texture browser fixture

Category: `runtime-orchestration`
Package/write-scope: `examples/standard-gltf-texture.js`,
`test/e2e/standard-gltf-texture.spec.ts`, and tracker docs if status changes.
Reference anchor:
`docs/research/GLB_OCCLUSION_EMISSIVE_BROWSER_FIXTURE_SPLIT_PLAN_2026_05_17.md`,
the GLB base-color/metallic-roughness fixtures, and the authored emissive
controlled browser scenario.

Acceptance criteria:

- Add `standard-gltf-texture?scenario=emissive` using glTF mapping and source
  registration for an `emissiveTexture`.
- Browser status reports JSON-safe emissive factor/color expectations, source
  asset keys, pipeline/resource counters, diagnostics, draw counts, and readback
  samples when available.
- Playwright verifies the mapped GLB-derived emissive texture renders through
  the app-facade path without claiming tone mapping, IBL, or full glTF PBR
  fidelity.
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts -g "emissive"`
  and `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts` pass.
