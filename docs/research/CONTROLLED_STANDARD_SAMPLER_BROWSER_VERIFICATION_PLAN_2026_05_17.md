# Controlled StandardMaterial Sampler Browser Verification Plan - 2026-05-17

## Scope

Plan the smallest browser-visible assertion proving StandardMaterial sampler
settings alter texture sampling.

This is a planning slice. It does not implement a browser scenario, shader
changes, sampler creation changes, GLB import, UV1, texture transforms, IBL, or
shadows.

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/research/STANDARD_MATERIAL_TEXTURE_BROWSER_GAP_AUDIT_2026_05_17.md`
- `docs/research/STANDARD_MATERIAL_TEXTURE_BROWSER_COVERAGE_AFTER_OCCLUSION_EMISSIVE_AUDIT_2026_05_17.md`
- `examples/standard-texture-control.js`
- `test/e2e/standard-texture-control.spec.ts`
- `test/e2e/sampler-filter-address.spec.ts`
- `packages/render/src/materials/standard-sampler-fidelity.ts`
- `packages/render/src/materials/standard-texture-readiness.ts`
- `packages/webgpu/src/webgpu/prepared-standard-material-cache.ts`

## Current State

StandardMaterial sampler handling is implemented below slot-specific browser
coverage:

- Source-side sampler readiness and sampler fidelity reports inspect
  StandardMaterial texture bindings by field.
- The WebGPU StandardMaterial preparation path creates sampler resources and
  binds them per active texture slot.
- Existing controlled StandardMaterial browser scenarios always use a nearest
  clamp sampler, so they prove sampler resources exist but not that sampler
  settings affect pixels.
- The multi-entity unlit browser path already has a sampler filter/address
  readback assertion, but it does not prove StandardMaterial sampling.

## Selected Browser Assertion

Add a positive `?scenario=base-color-linear-sampler` to
`examples/standard-texture-control.js`.

Use `baseColorTexture` for the sampler proof.

Reason:

- Base color has the most direct visible mapping from texture sample to final
  material color.
- It avoids PBR metallic/roughness interpretation, normal tangents, and
  ambient/emissive-specific lighting setup.
- The existing app-facade readback samples make sampler blending assertions
  more stable than screenshot-only checks.

Preferred fixture:

- Use a tiny 2x2 base-color texture with distinct neighboring texels.
- Use UVs that sample between texels, such as a centered point or a deliberate
  fractional coordinate.
- Render one StandardMaterial peer with nearest sampling and one with linear
  sampling, or compare the linear peer against expected/rejected colors while a
  scalar peer remains as the baseline.
- Keep `addressModeU/V/W: "clamp-to-edge"` for the first proof. Address-mode
  comparisons can be a later slice if needed.

Expected assertions:

- Snapshot includes the StandardMaterial sampler scenario with no diagnostics.
- Pipeline key remains `standard|baseColorTexture|opaque|back|less|none`;
  sampler choice should not create a new shader/pipeline variant.
- Two sampler resources are created if the scenario renders nearest and linear
  textured peers; otherwise one sampler resource is acceptable for a
  linear-only assertion.
- Readback sample is close to the expected linear blend and far from the
  nearest-only rejected color.
- Status publishes JSON-safe sampler settings, expected blended color, rejected
  nearest color, resource counters, pipeline keys, draw counts, readback
  samples, and diagnostic codes.

## Negative/Diagnostic Follow-Up

Do not combine sampler-fidelity warnings into the first pixel proof.

Potential later scenarios:

- sampler not ready/missing for StandardMaterial texture bindings;
- mipmap filter without mips;
- LOD max exceeding texture mip range;
- address-mode comparison using repeat or mirror-repeat.

These should remain separate because the first browser proof should answer only
whether StandardMaterial actually honors sampler filtering at draw time.

## Non-Goals

- No GLB import.
- No UV1 or texture transforms.
- No IBL or shadows.
- No broad sampler matrix.
- No shader or pipeline specialization for sampler state.

## Follow-Up

Add an implementation task for `base-color-linear-sampler` after the UV1 browser
slice or when sampler behavior becomes the next highest-priority browser gap.
Keep the fixture in the controlled StandardMaterial browser harness unless a
second StandardMaterial example needs the same sampler utility.
