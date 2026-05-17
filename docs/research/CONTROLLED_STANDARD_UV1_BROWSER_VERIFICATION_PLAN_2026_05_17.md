# Controlled StandardMaterial UV1 Browser Verification Plan - 2026-05-17

## Scope

Plan the smallest browser-visible verification that
`MaterialTextureBinding.texCoord: 1` changes StandardMaterial texture sampling.

This is a planning slice. It does not implement a browser scenario, shader
changes, GLB import, sampler comparisons, texture transforms, IBL, or shadows.

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/research/STANDARD_MATERIAL_TEXTURE_BROWSER_GAP_AUDIT_2026_05_17.md`
- `docs/research/STANDARD_MATERIAL_TEXTURE_BROWSER_COVERAGE_AFTER_OCCLUSION_EMISSIVE_AUDIT_2026_05_17.md`
- `docs/research/STANDARD_MATERIAL_UV1_PER_FIELD_COVERAGE_BOUNDARY_AUDIT_2026_05_17.md`
- `examples/standard-texture-control.js`
- `test/e2e/standard-texture-control.spec.ts`
- `packages/render/src/rendering/extraction.ts`
- `packages/render/src/materials/standard-texture-readiness.ts`
- `packages/webgpu/src/webgpu/standard-shader.ts`
- `packages/webgpu/src/webgpu/standard-pipeline-descriptor.ts`
- `test/materials/standard-texture-readiness.test.ts`
- `test/rendering/extraction.test.ts`
- `test/webgpu/standard-pipeline-descriptor.test.ts`

## Current State

UV1 support is implemented below browser coverage:

- Texture readiness accepts `texCoord: 1` for base-color,
  metallic-roughness, normal, occlusion, and emissive StandardMaterial slots.
- Extraction emits `render.standardMaterialTexture.missingTexCoord1` when a
  StandardMaterial texture binding asks for `TEXCOORD_1` but the mesh lacks a
  `TEXCOORD_1` vertex attribute.
- Pipeline keys add `uv1` when any rendered StandardMaterial texture binding
  uses `texCoord: 1`.
- WebGPU shader variants add a `uv1` vertex input and sample through
  `standardTextureUv(material.<field>TexCoord, input.uv, input.uv1)`.
- Unit, extraction, and pipeline descriptor tests already cover the per-field
  UV1 matrix.

The browser gap is fixture-level: the controlled texture browser currently uses
the built-in plane mesh with `POSITION`, `NORMAL`, and `TEXCOORD_0`, but no
`TEXCOORD_1`.

## Selected Browser Assertion

Add a positive `?scenario=base-color-uv1` to
`examples/standard-texture-control.js`.

Use `baseColorTexture` for the UV1 proof.

Reason:

- Base color has the clearest browser-visible texture result.
- It avoids normal-map tangents and PBR metallic/roughness interpretation.
- It does not require ambient-only or low-light fixture tuning.
- Existing base-color screenshot/readback assertions can be reused with minimal
  new logic.

Preferred fixture:

- Start from the existing controlled plane mesh.
- Add a local helper that appends a `TEXCOORD_1` `float32x2` attribute to the
  interleaved stream.
- Make UV0 point every vertex at a texel that resolves to the scalar-control
  "wrong" color, while UV1 points every vertex at the authored blue base-color
  texel. If changing UV0 in the source mesh is awkward, keep UV0 as-is and make
  UV1 deliberately sample a different solid/quad texel from the same 2x2
  texture.
- Author the textured StandardMaterial as
  `baseColorTexture: { texture, sampler, texCoord: 1 }`.

Expected assertions:

- Snapshot includes two StandardMaterial draws and no diagnostics.
- Pipeline keys include `standard|baseColorTexture|uv1|opaque|back|less|none`.
- Mesh layout keys include `POSITION,NORMAL,TEXCOORD_0,TEXCOORD_1`.
- One texture resource, one sampler resource, and two material buffers are
  created.
- Screenshot samples and app-facade readback show the textured peer resolves to
  the UV1-selected texel, not the scalar peer or clear color.
- Status publishes JSON-safe UV expectations, including `textureSlot`,
  `texCoord: 1`, expected UV1 sample color, pipeline keys, mesh layout keys,
  resource counters, readback samples, and diagnostic codes.

## Negative Path

Add `?scenario=base-color-uv1-missing-texcoord1` either in the same
implementation slice if it stays small or as the first follow-up.

The negative scenario should:

- author `baseColorTexture: { texture, sampler, texCoord: 1 }`;
- use the regular plane mesh without `TEXCOORD_1`;
- expect `render.standardMaterialTexture.missingTexCoord1`;
- verify the invalid frame submits no draw calls if both peers require UV1, or
  only the scalar/non-UV1 peer draws if the fixture keeps one valid baseline.

Prefer the all-invalid shape for consistency with the normal-map
missing-tangents browser scenario if the scenario is only testing the diagnostic.

## Non-Goals

- Do not add GLB import to prove UV1 yet.
- Do not implement texture transforms.
- Do not compare sampler filtering or wrap modes.
- Do not add IBL or shadows.
- Do not claim full glTF multi-UV material fidelity from this proof.

## Follow-Up

Create an implementation task for the positive `base-color-uv1` scenario and,
if small, the missing-`TEXCOORD_1` negative path. Keep the fixture local to the
controlled browser harness until multiple examples need reusable UV stream
construction.
