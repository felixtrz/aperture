# Alpha Texture Browser Pixel Assertion Helper Audit - 2026-05-18

## Scope

Audit `task-1470`, which extracted a shared alpha-mask texture pixel/readback
assertion helper in `test/e2e/standard-gltf-texture.spec.ts`.

Reference anchors inspected:

- `docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_ALPHA_MASK_EMISSIVE_PLAN_2026_05_18.md`
- `test/e2e/standard-gltf-texture.spec.ts`

## Findings

The extraction is test-only. It did not change runtime code, examples, render
logic, public diagnostics, or material behavior.

`expectAlphaMaskTexturePixels()` preserves the existing alpha-mask assertions:

- verifies the expected alpha-mask texture metadata and sample points exist;
- samples the browser screenshot at opaque and masked points;
- checks the opaque pixel is closer to the expected texture color than clear;
- checks the masked pixel is closer to clear than the opaque expected color;
- repeats the same comparisons for app readback samples when readback is
  available.

The helper is used by:

- the existing `alpha-mask-texture` browser fixture;
- the new combined `base-color-alpha-mask-emissive` browser fixture.

Render-state, glTF mapping, readiness, resource-count, pipeline-key, and
JSON-safe status assertions remain scenario-specific.

## Validation

- `pnpm exec prettier --check test/e2e/standard-gltf-texture.spec.ts`
- `pnpm run typecheck:test`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts`

## Recommendation

Proceed to tracker/backlog alignment. Public tracker pages do not need a feature
update for this helper-only cleanup.
