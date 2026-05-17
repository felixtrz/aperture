# Controlled StandardMaterial Texture-Transform Diagnostics Browser Plan - 2026-05-17

## Scope

Plan a narrow browser-visible negative path for unsupported StandardMaterial
texture transforms.

This is a planning slice. It does not implement texture-transform sampling,
shader changes, GLB import, UV1, sampler comparisons, IBL, or shadows.

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/research/STANDARD_MATERIAL_TEXTURE_BROWSER_GAP_AUDIT_2026_05_17.md`
- `docs/research/STANDARD_MATERIAL_TEXTURE_BROWSER_COVERAGE_AFTER_OCCLUSION_EMISSIVE_AUDIT_2026_05_17.md`
- `examples/standard-texture-control.js`
- `test/e2e/standard-texture-control.spec.ts`
- `packages/render/src/materials/standard-texture-readiness.ts`
- `packages/render/src/materials/gltf-material.ts`
- `test/materials/standard-texture-readiness.test.ts`
- `test/rendering/extraction.test.ts`

## Current State

StandardMaterial texture transforms are source-side authoring data but are not
rendered by the current shader variants:

- `MaterialTextureBinding.transform` can carry offset, scale, and rotation.
- StandardMaterial texture readiness accepts identity transforms but reports
  `standardMaterialTexture.unsupportedTextureTransform` for non-identity
  transforms.
- Render extraction promotes that readiness issue to
  `render.standardMaterialTexture.unsupportedTextureTransform` and blocks the
  affected draw.
- glTF material mapping preserves `KHR_texture_transform` values and reports
  current shader limits without claiming the transform is rendered.

The browser gap is diagnostic visibility in the controlled app-facade path.

## Selected Browser Assertion

Add a negative `?scenario=base-color-transform` to
`examples/standard-texture-control.js`.

Use `baseColorTexture` for the first transform diagnostic.

Reason:

- Base color is the simplest slot and already has positive, UV1, sampler, and
  source-status browser coverage.
- A non-identity transform on base color gives the clearest user-facing
  diagnostic without tangents or lighting-specific behavior.
- The goal is not to prove transformed sampling; it is to prove Aperture refuses
  unsupported transformed StandardMaterial texture bindings honestly.

Preferred scenario shape:

- Register a ready base-color texture and sampler.
- Author both StandardMaterial peers with
  `baseColorTexture: { texture, sampler, transform: { offset: [0.25, 0] } }`,
  or author only the textured peer if the test should preserve one valid scalar
  draw.
- Prefer the all-invalid shape if the assertion is "unsupported transformed
  StandardMaterial texture submits no draws", matching the normal-map
  missing-tangents scenario.
- Publish JSON-safe expected transform data and expected diagnostic code.

Expected assertions:

- Status is an expected failure with `ok: true` and
  `phase: "expected-failure"`.
- Diagnostic codes include
  `render.standardMaterialTexture.unsupportedTextureTransform`.
- Extraction reports diagnostics and no extracted mesh draws if both peers carry
  the transformed binding.
- Draw calls are zero.
- Status includes texture slot, texture/sampler keys, expected transform,
  resource counters, pipeline keys, and diagnostic codes without exposing source
  texture bytes or GPU handles.

## Non-Goals

- Do not implement texture-transform sampling.
- Do not add a GLB fixture for `KHR_texture_transform` yet.
- Do not combine this with UV1 or sampler comparison.
- Do not add IBL or shadows.
- Do not broaden transform support beyond the existing readiness/extraction
  diagnostic path.

## Follow-Up

Create an implementation task for `base-color-transform` after the current
controlled harness remains maintainable. If the harness grows too branch-heavy,
perform the harness maintainability audit first and then add the transform
diagnostic scenario.
