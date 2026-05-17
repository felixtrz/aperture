# StandardMaterial UV Coordinate Support Audit Plan - 2026-05-17

## Scope

Plan a focused audit of StandardMaterial texture-coordinate support before
adding more glTF-facing material behavior.

This is a planning slice only. It does not change shaders, material mapping, or
tests.

## References Inspected

- `packages/render/src/materials/types.ts`
- `packages/render/src/materials/standard-texture-readiness.ts`
- `packages/render/src/materials/pipeline-key.ts`
- `packages/render/src/materials/gltf-material.ts`
- `packages/webgpu/src/webgpu/standard-material-buffer.ts`
- `packages/webgpu/src/webgpu/standard-shader.ts`
- `packages/webgpu/src/webgpu/standard-pipeline-descriptor.ts`
- `test/webgpu/webgpu-app.test.ts`

## Current Understanding

`MaterialTextureBinding.texCoord` is optional and defaults to `0`.

StandardMaterial texture readiness currently treats `TEXCOORD_0` and
`TEXCOORD_1` as supported. Unsupported coordinates produce
`standardMaterialTexture.unsupportedTexCoord` diagnostics.

The StandardMaterial pipeline key includes a `uv1` feature when any texture
binding uses `texCoord === 1`. The WebGPU StandardMaterial shader conditionally
adds a `uv1` input and selects `uv0` or `uv1` in `standardTextureUv()`.

The material uniform stores per-field texture coordinate indices for base color,
metallic-roughness, normal, occlusion, and emissive texture bindings.

glTF material mapping accepts non-negative integer `texCoord` values and stores
them on material texture bindings. The readiness layer is the place that limits
runtime support to coordinates `0` and `1`.

## Audit Questions

The follow-up audit should answer:

- Are all five StandardMaterial texture fields consistently mapped from glTF
  `texCoord` into `MaterialTextureBinding.texCoord`?
- Do all five fields pack their `texCoord` into the StandardMaterial uniform?
- Does every textured shader variant sample through the same coordinate
  selection path?
- Do unsupported coordinates remain diagnostics instead of silent fallback or
  source asset mutation?
- Do tests cover `texCoord: 1` for all currently rendered texture families, or
  only a subset?
- Do docs/backlog honestly state that `TEXCOORD_0` and `TEXCOORD_1` are
  supported while higher sets are diagnostic-only?

## Non-Goals

- No support for `TEXCOORD_2+`.
- No texture transform implementation.
- No tangent-space normal rewrite.
- No shader feature expansion beyond auditing current behavior.
- No glTF loader broadening beyond texture-coordinate readiness.

## Recommended Audit Slice

Proceed with `task-0960`:

- inspect the mapping, packing, shader, and tests for each StandardMaterial
  texture field;
- document current coverage and gaps;
- add focused follow-up tasks only if the audit finds missing tests or
  misleading diagnostics.
