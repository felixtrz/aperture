# Controlled StandardMaterial Address-Mode Sampler Browser Verification Plan - 2026-05-18

## Scope

Plan a focused browser scenario proving StandardMaterial honors sampler address
mode state for base-color texture sampling.

This is a planning slice. It does not implement the scenario, add shader
features, change sampler resource creation, add GLB import, add texture
transforms, or broaden sampler diagnostics.

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/research/CONTROLLED_STANDARD_SAMPLER_BROWSER_VERIFICATION_PLAN_2026_05_17.md`
- `docs/research/STANDARD_MATERIAL_TEXTURE_BROWSER_COVERAGE_AFTER_TRANSFORM_GLB_AUDIT_2026_05_18.md`
- `examples/standard-texture-control.js`
- `test/e2e/standard-texture-control.spec.ts`
- `packages/render/src/materials/standard-sampler-fidelity.ts`
- `packages/render/src/materials/standard-texture-sampler-alignment.ts`

## Current State

The controlled browser harness now proves StandardMaterial uses sampler filter
state through `?scenario=base-color-linear-sampler`.

That scenario intentionally keeps address modes at `clamp-to-edge`, so it does
not prove repeat or mirror-repeat behavior. Source-side sampler diagnostics can
summarize sampler state, and WebGPU preparation already creates real sampler
resources for active StandardMaterial texture bindings.

## Selected Browser Scenario

Add `?scenario=base-color-repeat-sampler` to
`examples/standard-texture-control.js`.

Use the existing base-color StandardMaterial slot and a local UV fixture that
sets `TEXCOORD_0` to a coordinate outside the `[0, 1]` range for the textured
peer, for example `{ u: 1.25, v: 0.25 }`.

Texture data:

- Use a 2x2 sRGB base-color texture with the repeat-resolved texel blue and the
  clamp-resolved texel red.
- Use nearest filtering so the assertion isolates address mode rather than
  filter interpolation.

Sampler setup:

- For the repeat proof, set `addressModeU: "repeat"` and
  `addressModeV: "clamp-to-edge"`.
- Keep `addressModeW: "clamp-to-edge"` and all filters `"nearest"`.

Expected visual behavior:

- With `repeat`, `u: 1.25` wraps to `u: 0.25`, sampling the blue texel.
- If the sampler behaved like `clamp-to-edge`, the same coordinate would clamp
  near `u: 1`, sampling the red texel.

## Expected Status Fields

Publish under `standardTexture.expectedSampler` or a new adjacent
`expectedAddressMode` field:

- `addressModeU: "repeat"`;
- `addressModeV: "clamp-to-edge"`;
- `expectedColor`;
- `rejectedClampColor`;
- `sampleUv: { u: 1.25, v: 0.25 }`.

Keep the status JSON-safe. Do not publish texture bytes, GPU sampler objects,
backend cache maps, queues, encoders, or raw WebGPU handles.

## Expected Browser Assertions

The Playwright scenario should assert:

- status is rendered and JSON-safe;
- extraction has one view, two mesh draws, two lights, and zero diagnostics;
- one texture resource and one sampler resource are created;
- pipeline key remains `standard|baseColorTexture|opaque|back|less|none`;
- mesh layout remains `POSITION,NORMAL,TEXCOORD_0`;
- sampler status reports `addressModeU: "repeat"`;
- screenshot sample and readback sample, when available, are closer to
  `expectedColor` than `rejectedClampColor`;
- no WebGPU validation console warnings are emitted.

## Non-Goals

- Do not include mirror-repeat in the first implementation. Add it only if a
  later vertical slice needs it.
- Do not combine this with GLB import or GLB sampler mapping.
- Do not add texture-transform support.
- Do not add mipmap or anisotropy diagnostics to the browser scenario.
- Do not create a new public helper API; keep scenario helpers local to the
  controlled browser harness.

## Follow-Up Task

### task-1104 - Add controlled StandardMaterial repeat sampler browser verification

Category: `runtime-orchestration`
Package/write-scope: `examples/standard-texture-control.js` and
`test/e2e/standard-texture-control.spec.ts`.
Reference anchor:
`docs/research/CONTROLLED_STANDARD_ADDRESS_MODE_SAMPLER_BROWSER_VERIFICATION_PLAN_2026_05_18.md`
and the existing controlled StandardMaterial texture browser harness.

Acceptance criteria:

- Add `?scenario=base-color-repeat-sampler` with a local out-of-range UV mesh
  fixture, repeat-U sampler settings, and expected/rejected sample colors.
- Browser status reports JSON-safe sampler address expectations, resource
  counters, pipeline keys, draw counts, and readback samples when available.
- Playwright proves repeat address-mode sampling is closer to the expected
  wrapped texel than the rejected clamp texel.
- `pnpm exec playwright test test/e2e/standard-texture-control.spec.ts -g "repeat sampler"`
  and `pnpm exec playwright test test/e2e/standard-texture-control.spec.ts`
  pass.
