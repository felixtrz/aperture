# StandardMaterial UV Coordinate Support Boundary Audit - 2026-05-17

## Scope

Audit current StandardMaterial texture-coordinate support after the planning
slice.

This audit checks mapping, packing, shader selection, diagnostics, and test
coverage. It does not change implementation.

## References Inspected

- `packages/render/src/materials/types.ts`
- `packages/render/src/materials/standard-texture-readiness.ts`
- `packages/render/src/materials/pipeline-key.ts`
- `packages/render/src/materials/gltf-material.ts`
- `packages/webgpu/src/webgpu/standard-material-buffer.ts`
- `packages/webgpu/src/webgpu/standard-shader.ts`
- `packages/webgpu/src/webgpu/standard-pipeline-descriptor.ts`
- `test/materials/gltf-material.test.ts`
- `test/materials/standard-texture-readiness.test.ts`
- `test/webgpu/standard-material-buffer.test.ts`
- `test/webgpu/standard-shader.test.ts`
- `test/webgpu/standard-pipeline-descriptor.test.ts`
- `test/webgpu/webgpu-app.test.ts`

## Findings

Current behavior is mostly coherent:

- glTF material mapping accepts non-negative integer `texCoord` values and
  stores them on `MaterialTextureBinding`.
- StandardMaterial readiness treats `TEXCOORD_0` and `TEXCOORD_1` as supported
  and emits `standardMaterialTexture.unsupportedTexCoord` for higher
  coordinates.
- The material pipeline key adds `uv1` when any StandardMaterial texture binding
  uses `texCoord === 1`.
- StandardMaterial uniform packing stores per-field texture coordinate indices
  for base color, metallic-roughness, normal, occlusion, and emissive textures.
- The shader's textured variant adds a `uv1` input when needed and samples via
  `standardTextureUv(material.<field>TexCoord, input.uv, input.uv1)`.

No source material mutation or hidden renderer state was found.

## Coverage Gap

Existing tests cover pieces of the path, but not all fields uniformly:

- glTF mapping tests cover `texCoord: 1` on base color.
- texture readiness tests cover unsupported `texCoord: 2` on base color.
- material buffer tests prove all five StandardMaterial texture fields can pack
  distinct `texCoord` values.
- shader/pipeline tests cover the `uv1` feature path.
- app tests cover textured StandardMaterial fields, but not a focused
  per-field `texCoord: 1` matrix.

The next implementation task should add narrow tests that prove
`TEXCOORD_1`/`uv1` readiness and feature selection for every StandardMaterial
texture field, without changing shader behavior.

## Follow-Up Backlog Recommendation

Add a focused test task before broader alpha/cull work:

```md
### task-0961 — Add StandardMaterial UV1 per-field coverage

Category: `webgpu-render`
Package/write-scope: `test/materials`, `test/webgpu`, and no production code
unless tests expose a bug.
Reference anchor:
StandardMaterial UV coordinate support audit from `task-0960`, shader
`uv1` feature selection, and material buffer texCoord packing.

Acceptance criteria:

- Tests cover `texCoord: 1` readiness for base color, metallic-roughness,
  normal, occlusion, and emissive texture fields.
- Tests cover pipeline key or shader feature selection for `uv1`.
- Existing behavior remains unchanged.
```

## Validation

No code validation was required for this audit. Existing relevant validation
from this run:

- `pnpm run check`
