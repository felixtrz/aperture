# Next StandardMaterial Color-Space Format Slice Plan

Date: 2026-05-18

## Scope

Plan the next narrow StandardMaterial sampler/color-space or route slice after
finite transformed `TEXCOORD_1` support.

This is a planning slice. It does not implement diagnostics, change WebGPU
texture upload, add a new app route, add IBL or shadows, parse binary GLB
containers, or add a new material family.

## References Inspected

- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/STANDARD_MATERIAL_TRANSFORMED_UV1_SUPPORT_AUDIT_2026_05_18.md`
- `docs/DIAGNOSTICS_SUMMARIES.md`
- `packages/render/src/materials/standard-texture-readiness.ts`
- `packages/render/src/materials/standard-sampler-fidelity.ts`
- `packages/render/src/materials/standard-texture-sampler-alignment.ts`
- `packages/render/src/materials/types.ts`
- `packages/render/src/materials/validation.ts`
- `test/materials/standard-texture-readiness.test.ts`
- `test/materials/standard-sampler-fidelity.test.ts`

## Current State

StandardMaterial texture readiness already reports:

- semantic mismatches by texture slot;
- expected color-space class by texture slot;
- missing/loading/failed texture and sampler dependencies;
- unsupported `texCoord` values;
- unsupported or non-finite texture transforms.

Sampler fidelity is already a separate renderer-independent report for ready
texture/sampler pairs. It warns about mip filtering without mips, LOD range
pressure, and authored anisotropy, and a separate alignment helper can combine
texture readiness and sampler fidelity for diagnostics consumers.

The remaining color-space gap is narrower: readiness checks the authored
`TextureAsset.colorSpace`, but it does not check whether `TextureAsset.format`
matches that color-space declaration. For example, a base-color texture can be
declared as `srgb` while using `rgba8unorm`, or a normal/metallic data texture
can be declared as `linear`/`data` while using an `*-srgb` format. Those states
are renderer-independent source-asset metadata problems and should be diagnosed
before WebGPU preparation.

## Selected Slice

Implement StandardMaterial texture format/color-space readiness diagnostics.

Add a warning-level diagnostic to
`createStandardMaterialTextureReadinessReport()` when a ready texture slot has
incompatible source texture metadata:

- `colorSpace: "srgb"` should use an `*-srgb` format.
- `colorSpace: "linear"` or `"data"` should use a non-sRGB format.

Keep the check renderer-independent and source-asset only. It should not create
WebGPU textures, change upload behavior, generate mips, alter sampler state, or
change material routing.

## Implementation Task

### task-1225 - Add StandardMaterial texture format/color-space diagnostics

Category: `render-bridge`
Package/write-scope: `packages/render/src/materials/standard-texture-readiness.ts`
and `test/materials/standard-texture-readiness.test.ts`.
Reference anchor:
`docs/research/NEXT_STANDARD_MATERIAL_COLOR_SPACE_FORMAT_SLICE_PLAN_2026_05_18.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and the existing StandardMaterial texture
readiness diagnostics.

Acceptance criteria:

- Ready StandardMaterial texture slots warn when `TextureAsset.colorSpace` and
  `TextureAsset.format` disagree about sRGB encoding.
- Diagnostics include material key, texture key, texture field, expected
  color-space class, actual color space, and actual texture format.
- Existing semantic, color-space, UV, transform, texture dependency, and sampler
  dependency behavior is preserved.
- Targeted tests cover both sRGB textures with non-sRGB formats and data/linear
  textures with sRGB formats.
- No WebGPU upload behavior, app route, IBL, shadows, binary GLB loading, or new
  material family is added.

## Deferred Alternatives

- Sampler route cleanup remains useful, but current sampler fidelity and
  alignment helpers already preserve the renderer-independent boundary.
- Address-mode browser verification has an existing plan and can follow once
  source metadata diagnostics are tighter.
- IBL, shadows, binary GLB viewer integration, and broad material-family route
  migration remain deferred.
