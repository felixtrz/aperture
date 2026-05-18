# Next Transformed UV1 Or Lighting Boundary Plan

Date: 2026-05-18

## Scope

Choose the next narrow StandardMaterial task after completing transformed
`TEXCOORD_0` coverage and the route/prepared-resource cleanup regression.

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/ROADMAP.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/STANDARD_MATERIAL_EMISSIVE_TRANSFORM_SUPPORT_AUDIT_2026_05_18.md`
- `docs/research/STANDARD_MATERIAL_ROUTE_PREPARED_RESOURCE_CLEANUP_AUDIT_2026_05_18.md`
- `packages/render/src/materials/gltf-material.ts`
- `packages/render/src/materials/standard-texture-readiness.ts`
- `packages/webgpu/src/webgpu/standard-shader.ts`
- `packages/webgpu/src/webgpu/standard-pipeline-descriptor.ts`
- `test/materials/standard-texture-readiness.test.ts`
- `test/webgpu/standard-shader.test.ts`

## Options

### Option A: Transformed `TEXCOORD_1`

This is the smallest implementation step. StandardMaterial already supports
untransformed `TEXCOORD_1` texture variants, shader generation already selects
between `uv` and `uv1`, and transform sampling is applied after UV selection.
The current missing piece is the conservative readiness/glTF gate that rejects
finite transformed non-UV0 bindings.

Expected scope:

- allow finite transforms on `TEXCOORD_1` for the currently rendered
  StandardMaterial texture slots;
- keep unsupported diagnostics for `texCoord > 1`, non-finite transform values,
  and unsupported texture semantics;
- add targeted material-readiness and glTF mapping tests;
- add one browser fixture or shader-level regression if needed.

### Option B: Direct-light / IBL contract work

This advances the lighting roadmap, but it is broader. It would need a
dedicated contract for environment lighting readiness, resource preparation,
shader metadata, and diagnostics. It should not be mixed into the same slice as
UV handling.

### Option C: Another route cleanup

The latest cleanup regression covered the most immediate cache/diagnostics risk.
Another cleanup is useful soon, but it is not the next smallest fidelity gap.

## Decision

Select Option A: transformed `TEXCOORD_1` support for finite StandardMaterial
texture transforms.

This advances the documented UV set handling goal without introducing IBL,
shadows, binary GLB loading, a new route, or a new material family. It also
turns an existing diagnostic-only gap into rendered behavior using shader
infrastructure that is already present.

## Implementation Task

Add `task-1220` for transformed `TEXCOORD_1` support:

- category: `render-bridge`;
- package/write-scope: `packages/render`, targeted material tests, and only
  shader/browser tests if implementation proves a WebGPU-side gap;
- reference anchor: this plan, recent transform audits, and Bevy's
  material/texture-coordinate readiness pattern;
- acceptance criteria:
  - finite transforms on `TEXCOORD_1` are accepted for currently rendered
    StandardMaterial texture slots;
  - glTF mapping preserves finite `KHR_texture_transform` data on
    `TEXCOORD_1`;
  - unsupported `texCoord > 1` and non-finite transform values continue to emit
    structured diagnostics;
  - tests prove the boundary without adding IBL, shadows, GLB viewer behavior,
    or a new app route.
