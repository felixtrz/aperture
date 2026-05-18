# Multi Texture Standard Assertion Helper Audit - 2026-05-18

## Scope

Audit the `task-1449` helper extraction in
`test/e2e/standard-gltf-texture.spec.ts`.

Reference anchors inspected:

- `docs/ARCHITECTURE.md`
- `docs/research/NEXT_MATERIAL_ROUTE_OR_STANDARD_FOLLOW_UP_AFTER_GLB_COMBINED_BASE_COLOR_OCCLUSION_EMISSIVE_PLAN_2026_05_18.md`
- `test/e2e/standard-gltf-texture.spec.ts`

## Findings

The extraction is test-only. No runtime, renderer, ECS, asset, or WebGPU source
files changed.

`expectRenderedMultiTextureStandardStatus()` preserves the shared assertions
from the three combined StandardMaterial scenarios:

- rendered WebGPU status shape
- glTF texture and sampler counts
- glTF sampler mapping by texture slot
- material registration write counts
- primary `standardTexture` mesh/material/texture/sampler identity
- per-slot readiness with zero diagnostics
- texture/sampler/material-buffer/bind-group resource counts
- material pipeline key and mesh-layout key
- sampler status JSON safety by checking no backend resources leak into mapped
  sampler status

The scenario-specific checks remain in each browser test:

- combined base-color plus metallic-roughness still checks the sampled pixel is
  blue-dominant and applies the same readback comparison.
- combined base-color plus metallic-roughness plus normal still checks the
  normal-influenced blue-dominant pixel and readback comparison.
- combined base-color plus occlusion plus emissive still checks non-clear
  screenshot and readback pixels.

## Validation

- `pnpm exec prettier --check test/e2e/standard-gltf-texture.spec.ts`
- `pnpm run typecheck:test`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts`

## Recommendation

Proceed to tracker/backlog alignment. Because this was a test-only cleanup, the
public tracker likely does not need material status percentage changes unless
the run summary wants to mention reduced E2E maintenance risk.
