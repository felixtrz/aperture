# GLB StandardMaterial Texture Browser Fixture Plan - 2026-05-17

## Scope

Plan the smallest GLB browser fixture that can honestly exercise currently
supported StandardMaterial texture behavior.

This is a planning slice. It does not implement GLB loading in a browser
example, add fixture assets, change material mapping, implement IBL, shadows,
texture transforms, or claim full glTF PBR fidelity.

## References Inspected

- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/STANDARD_MATERIAL_GLTF_PBR_TEXTURE_AUDIT_2026_05_17.md`
- `docs/research/STANDARD_MATERIAL_TEXTURE_BROWSER_COVERAGE_AFTER_OCCLUSION_EMISSIVE_AUDIT_2026_05_17.md`
- `docs/research/CONTROLLED_STANDARD_UV1_BROWSER_VERIFICATION_PLAN_2026_05_17.md`
- `docs/research/CONTROLLED_STANDARD_SAMPLER_BROWSER_VERIFICATION_PLAN_2026_05_17.md`
- `packages/render/src/assets/gltf-asset-mapping.ts`
- `packages/render/src/materials/gltf-material.ts`
- `test/assets/gltf-source-registration-orchestration.test.ts`
- `test/materials/gltf-material.test.ts`

## Current State

Authored StandardMaterial browser coverage is now stronger than GLB browser
coverage:

- Controlled authored scenarios prove base color, base-color UV1, base-color
  linear sampler, metallic-roughness, normal maps, occlusion, emissive, source
  texture failures, missing tangents, and app-facade readback.
- glTF/GLB mapping tests already cover material texture slots, sampler mapping,
  alpha/double-sided state, and preservation/diagnostics for unsupported
  texture transforms.
- GLB source registration orchestration can register material, texture, sampler,
  and mesh source reports together in tests.

The remaining gap is a browser fixture that loads or replays a GLB-derived
source mapping through the same app-facade render path without overstating
unsupported PBR features.

## Selected Fixture

Use a tiny uncompressed GLB or GLB-equivalent test fixture with one mesh, one
material, one base-color texture, and one sampler.

Preferred first browser assertion:

- one triangle or quad mesh with `POSITION`, `NORMAL`, and `TEXCOORD_0`;
- one glTF metallic-roughness material with:
  - `baseColorTexture.index`;
  - default metallic factor `0`;
  - roughness factor around `0.8`;
  - opaque, single-sided state;
- one 2x2 sRGB base-color texture with a high-contrast texel;
- one sampler using settings already proven in authored scenarios, preferably
  nearest clamp for the first fixture.

Reason:

- Base color is the most direct and stable StandardMaterial texture proof.
- It avoids tangent generation, UV1, sampler comparison, transforms, IBL,
  shadows, alpha sorting, and full metallic/roughness interpretation.
- It can be compared against the existing authored base-color browser scenario.

## Browser Shape

Add a dedicated GLB browser example only when the loader/orchestration path can
produce ECS-authored entities and source assets without bespoke renderer-owned
state.

Expected status should report:

- GLB fixture id and mapping summary;
- material, texture, sampler, and mesh handle keys;
- StandardMaterial texture slot and expected color;
- extraction counts and diagnostics;
- pipeline keys and mesh layout keys;
- resource counters and draw counts;
- optional app-facade readback samples.

It must not expose raw binary payloads, decoded image bytes, GPU resources,
backend cache maps, command encoders, queues, or mutable scene objects.

## Authored Versus Imported Coverage

Keep these as authored-source tests:

- precise slot behavior for base color, metallic-roughness, normal, occlusion,
  emissive;
- UV1 behavior;
- sampler filtering comparison;
- missing-tangent and transform diagnostics.

Use GLB browser tests only for imported handoff:

- glTF material/texture/sampler mapping produces the same source asset shapes;
- mapped source assets render through the same ECS/app-facade path;
- unsupported GLB features are diagnosed rather than silently approximated.

## Deferred GLB Fixture Work

Do not include these in the first GLB browser fixture:

- normal maps without authored tangents or tangent generation;
- texture transforms;
- UV1;
- sampler filtering comparisons;
- alpha blend/sort behavior;
- IBL, shadows, or environment lighting;
- KTX2/Basis, Draco, Meshopt, sparse accessors, skins, morphs, animation, or
  advanced material extensions.

## Follow-Up

After the texture-control harness helper extraction and base-color transform
diagnostic scenario, add an implementation task for a minimal GLB
StandardMaterial base-color browser fixture. The task should reuse existing GLB
mapping/orchestration helpers and compare the rendered result against the
authored base-color scenario rather than adding a parallel renderer path.
