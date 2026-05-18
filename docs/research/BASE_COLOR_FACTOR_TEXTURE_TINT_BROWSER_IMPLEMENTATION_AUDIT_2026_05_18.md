# Base-Color Factor Texture Tint Browser Implementation Audit

Date: 2026-05-18

Task: `task-1633`

## Scope

Audit the `task-1632` glTF browser fixture proving that
`pbrMetallicRoughness.baseColorFactor` tints `baseColorTexture`.

## Findings

- Added a `base-color-factor-texture-tint` scenario to
  `examples/standard-gltf-texture.js`.
- The scenario maps a glTF StandardMaterial with `baseColorTexture` and a
  non-white `baseColorFactor`, then publishes JSON-safe expected tinted and
  untinted color metadata.
- Added Playwright coverage that verifies the scenario renders through the
  existing `standard|baseColorTexture|opaque|back|less|none` pipeline, creates
  one texture, one sampler, and one material buffer, and produces screenshot and
  readback pixels closer to the tinted expectation than to the untinted texture
  sample or clear color.

## Boundary Check

- The change stays in the existing example and E2E test surface.
- ECS authoring, render extraction, material route traversal, app-level
  non-built-in rendering, binary GLB loading, IBL, shadows, and material-family
  registration policy are unchanged.
- Status output remains JSON-safe and does not expose raw GPU handles.
- The fixture locks existing StandardMaterial shader/material-buffer behavior
  rather than adding a new material feature.

## Validation

- `node --check examples/standard-gltf-texture.js`
- `pnpm run typecheck:test`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts -g "baseColorFactor"`

## Recommendation

Proceed to tracker/backlog alignment. The next planning task should compare
another narrow StandardMaterial/glTF fidelity gap against any newly visible
route/prepared-resource cleanup, with route cleanup still preferred only when it
is not a broad non-built-in app rendering step.
