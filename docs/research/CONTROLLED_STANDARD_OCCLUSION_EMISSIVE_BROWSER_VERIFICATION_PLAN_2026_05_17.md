# Controlled StandardMaterial Occlusion/Emissive Browser Verification Plan - 2026-05-17

## Scope

Plan browser-visible verification for `StandardMaterial.occlusionTexture` and
`StandardMaterial.emissiveTexture` after base-color, metallic-roughness, and
app-facade readback coverage landed.

This is a planning slice. It does not implement browser scenarios, shader
changes, GLB import, IBL, shadows, sampler comparisons, UV1, or texture
transforms.

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/STANDARD_MATERIAL_TEXTURE_BROWSER_GAP_AUDIT_2026_05_17.md`
- `examples/standard-texture-control.js`
- `examples/materials-showcase.js`
- `test/e2e/materials-showcase.spec.ts`
- `packages/webgpu/src/webgpu/standard-shader.ts`
- `packages/webgpu/src/webgpu/prepared-standard-material-cache.ts`
- `test/webgpu/standard-shader.test.ts`
- `test/webgpu/prepared-standard-material-cache.test.ts`
- `test/webgpu/webgpu-app.test.ts`
- `test/materials/standard-texture-readiness.test.ts`

## Current State

Occlusion and emissive texture paths are implemented below browser coverage:

- `standard-shader.ts` samples occlusion from the red channel and mixes it with
  `occlusionStrength`, then applies it to the ambient diffuse term.
- `standard-shader.ts` samples emissive RGB and multiplies it by
  `emissiveFactor`, then adds that term to final color.
- Prepared-resource tests cover occlusion-only, emissive-only, and combined
  occlusion/emissive texture variants.
- The materials showcase authors both slots, but the browser test only proves
  broad visibility and published feature names.

## Decision

Use one implementation task with two explicit controlled scenarios rather than
one combined visual assertion.

Reason:

- Occlusion only affects the ambient diffuse term in the current direct-lit MVP.
  A reliable assertion should use ambient-dominant lighting so direct light does
  not hide the occlusion contribution.
- Emissive adds light independent of scene lighting. A reliable assertion should
  use dark or low-light conditions so emissive contribution is isolated.
- Combining both in one rendered peer would make the pixel difference harder to
  attribute and less useful for future agents.

## Selected Browser Assertions

Extend `examples/standard-texture-control.js` with two scenarios:

1. `?scenario=occlusion`
   - Render a scalar StandardMaterial peer and an occlusion-textured peer.
   - Use fixed ambient-dominant lighting and little or no directional
     contribution.
   - Use a tiny occlusion texture with a low red channel on the sampled texel
     and `occlusionStrength: 1`.
   - Assert the occlusion peer is visibly darker than the scalar peer while
     both differ from the clear color.
   - Verify pipeline key `standard|occlusionTexture|opaque|back|less|none`,
     one texture resource, one sampler resource, no diagnostics, and app-facade
     readback when available.

2. `?scenario=emissive`
   - Render a scalar low-light StandardMaterial peer and an emissive-textured
     peer.
   - Use low or no lights so emissive contribution is visible without relying
     on direct lighting.
   - Use an sRGB emissive texture and a nonzero `emissiveFactor`.
   - Assert the emissive peer is visibly brighter or color-shifted relative to
     the scalar peer and clear color.
   - Verify pipeline key `standard|emissiveTexture|opaque|back|less|none`, one
     texture resource, one sampler resource, no diagnostics, and app-facade
     readback when available.

## Status Shape

Each scenario should publish JSON-safe status with:

- `textureSlot`;
- expected occlusion or emissive values;
- pipeline keys;
- texture/sampler/material resource counters;
- draw counts;
- app-facade readback samples when available;
- diagnostic codes.

Do not expose source texture payloads, GPU textures, samplers, bind groups,
buffers, command encoders, queues, or backend cache maps.

## Non-Goals

- No IBL or shadows. Occlusion remains an ambient-term MVP approximation.
- No GLB import. Use authored StandardMaterial source assets first.
- No sampler comparison, UV1 browser proof, or texture-transform support.
- No full glTF PBR claim from these scenarios.

## Follow-Up

Proceed with `task-1088` as one implementation slice containing the two
scenarios above. Keep the task narrow: if one scenario proves unstable, land the
stable one and split the other into a follow-up rather than broadening the
fixture.
