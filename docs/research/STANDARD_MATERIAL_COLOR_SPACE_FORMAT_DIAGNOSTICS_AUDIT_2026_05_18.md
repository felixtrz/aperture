# StandardMaterial Color-Space Format Diagnostics Audit

Date: 2026-05-18

## Scope

Audit the `task-1225` implementation of StandardMaterial texture
format/color-space readiness diagnostics.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/NEXT_STANDARD_MATERIAL_COLOR_SPACE_FORMAT_SLICE_PLAN_2026_05_18.md`
- `packages/render/src/materials/standard-texture-readiness.ts`
- `test/materials/standard-texture-readiness.test.ts`
- `references/bevy/crates/bevy_image/src/image.rs`

## Findings

Pass. The implementation stayed within the selected source-metadata diagnostics
scope.

`createStandardMaterialTextureReadinessReport()` now records each ready
StandardMaterial texture slot's concrete `TextureAsset.format` and warns when
the source texture's declared `colorSpace` disagrees with whether the format is
sRGB encoded:

- `colorSpace: "srgb"` expects an `*-srgb` texture format;
- `colorSpace: "linear"` or `"data"` expects a non-sRGB texture format.

The diagnostic includes material key, texture key, texture field, expected
color-space class, actual color space, expected sRGB format class, and actual
texture format. The slot `ready` flag now treats format/color-space mismatch as
not ready, matching the existing semantic/color-space readiness behavior.

The change is renderer-independent. It reads source `TextureAsset` metadata
from the asset registry and does not create WebGPU textures, change sampler
state, mutate source assets, add an app route, add IBL or shadows, or alter
prepared StandardMaterial cache keys.

The Bevy reference supports the direction conceptually: image assets carry
texture formats and sRGB view-format information while GPU resource preparation
remains renderer-side. Aperture's version keeps that split in TypeScript by
diagnosing source metadata before WebGPU preparation.

## Validation

- `pnpm exec vitest run test/materials/standard-texture-readiness.test.ts`

## Recommendation

Next work should target the lighting contract selected by `task-1224`:
`task-1227` environment-map readiness reporting. A broader route/prepared
resource cleanup is not required by this source-side diagnostics change.
