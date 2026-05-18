# Base-Color Factor Texture Tint Browser Plan Audit

Date: 2026-05-18

Task: `task-1631`

## Scope

Audit the `task-1630` plan to add a glTF-shaped browser proof that
`pbrMetallicRoughness.baseColorFactor` tints `baseColorTexture`.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/DECISIONS.md`
- `docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_FRAME_RESOURCE_DIAGNOSTIC_HELPER_PLAN_2026_05_18.md`
- `packages/webgpu/src/webgpu/standard-shader.ts`
- `packages/webgpu/src/webgpu/standard-material-buffer.ts`
- `packages/render/src/materials/gltf-material.ts`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`
- `references/three.js/src/materials/MeshStandardMaterial.js`
- `references/engine/src/scene/materials/standard-material.js`

## Findings

- The selected follow-up is concrete enough for one focused run. Aperture's
  Standard shader already multiplies the sampled base-color texture by
  `material.baseColorFactor.rgb` and multiplies texture alpha by
  `material.baseColorFactor.a`; the browser fixture should lock this behavior
  against regressions.
- The reference engines expose the same conceptual behavior: three.js documents
  `map` as modulated by material diffuse color, and PlayCanvas separates
  diffuse color from diffuse map inputs.
- The fixture can stay inside the existing `standard-gltf-texture` example and
  Playwright spec. It should not require package-boundary changes, new
  dependencies, route traversal changes, or new material-family APIs.
- The test should compare against both clear color and an untinted sample so it
  proves tinting, not merely non-clear rendering.

## Boundary Check

- ECS authority and render extraction remain unchanged. The scenario authors a
  source glTF material that maps into existing ECS/material assets.
- WebGPU remains the only backend; GPU resources stay renderer-owned.
- JSON-safe status is already the fixture convention and should not expose raw
  texture, sampler, buffer, bind group, or device handles.
- The task must not expand into binary GLB loading, IBL, shadows, or
  app-level non-built-in material rendering.

## Recommendation

Proceed to `task-1632` as planned. Keep the implementation limited to the
example fixture and focused Playwright assertions unless the test exposes a
small shader/status defect.

## Suggested Validation

- `node --check examples/standard-gltf-texture.js`
- `pnpm run typecheck:test`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts -g "base-color factor"`
