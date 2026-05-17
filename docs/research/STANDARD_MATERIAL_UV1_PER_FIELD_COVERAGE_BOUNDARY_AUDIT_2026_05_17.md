# StandardMaterial UV1 Per-Field Coverage Boundary Audit - 2026-05-17

## Scope

Audit the `task-0961` test-only coverage slice for StandardMaterial
`TEXCOORD_1` support.

This audit checks whether the added coverage changed shader behavior, source
asset mutation rules, unsupported higher-UV diagnostics, or renderer/backend
ownership boundaries.

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/research/STANDARD_MATERIAL_UV_COORDINATE_SUPPORT_BOUNDARY_AUDIT_2026_05_17.md`
- `packages/render/src/materials/standard-texture-readiness.ts`
- `packages/render/src/materials/pipeline-key.ts`
- `packages/webgpu/src/webgpu/standard-material-buffer.ts`
- `packages/webgpu/src/webgpu/standard-shader.ts`
- `packages/webgpu/src/webgpu/standard-pipeline-descriptor.ts`
- `test/materials/standard-texture-readiness.test.ts`
- `test/webgpu/standard-pipeline-descriptor.test.ts`
- `references/engine/src/framework/parsers/glb-parser.js`
- `references/engine/src/scene/shader-lib/programs/standard.js`
- `references/three.js/src/textures/Texture.js`
- `references/three.js/src/renderers/webgl/WebGLProgram.js`

## Findings

The new coverage is boundary-safe:

- The slice only edits tests in the declared `test/materials` and `test/webgpu`
  scopes.
- StandardMaterial source assets remain plain renderer-independent data; tests
  author `MaterialTextureBinding.texCoord` values and do not mutate materials.
- Texture readiness now explicitly proves `texCoord: 1` is accepted for base
  color, metallic-roughness, normal, occlusion, and emissive texture fields.
- WebGPU pipeline descriptor tests now prove every StandardMaterial texture
  field can select a `uv1` shader variant and vertex layout. The normal-map case
  still requires tangents and adds `TEXCOORD_1` beside them.
- No production shader string, material buffer packing, pipeline-key, or
  extraction code changed.

## Unsupported UV Sets

The existing `TEXCOORD_2+` behavior remains diagnostic-only:

- `standard-texture-readiness` still accepts only `0` and `1`.
- The existing unsupported-UV readiness test remains in place.
- The new tests add positive `TEXCOORD_1` coverage and do not loosen
  unsupported higher-UV behavior.

## Backlog Impact

No UV1 follow-up is required from this audit. The next ready task should remain
the StandardMaterial alpha/cull diagnostics plan (`task-0963`).

## Validation

- `pnpm exec vitest run test/materials/standard-texture-readiness.test.ts test/webgpu/standard-pipeline-descriptor.test.ts`
