# Standard glTF Occlusion Strength Browser Coverage Audit - 2026-05-18

## Scope

Audit the StandardMaterial/glTF occlusion texture strength browser fixture.

Reference anchors inspected:

- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/STANDARD_GLTF_FIDELITY_GAP_AUDIT_2026_05_18.md`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`
- `packages/render/src/materials/gltf-material.ts`
- `packages/webgpu/src/webgpu/standard-shader.ts`

## Findings

The implementation satisfies the selected scope:

- Added the `occlusion-strength` glTF-shaped StandardMaterial browser scenario.
- Authored `occlusionTexture.strength` as `0.25` while reusing the existing
  occlusion texture slot and pipeline path.
- Extended status expectations so the fixture reports the mapped occlusion
  texture, strength value, resource counts, pipeline key, and JSON-safe
  diagnostics.
- Added Playwright coverage that compares readback output against the existing
  full-strength occlusion control and asserts the non-default strength changes
  rendered output.

The fixture stays on the existing ECS-authored app path and built-in
StandardMaterial route. It does not add IBL, shadows, binary GLB loading, larger
combined PBR fixtures, or app-level non-built-in rendering.

## Validation

- `node --check examples/standard-gltf-texture.js`
- `pnpm run typecheck:test`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts -g "occlusion texture strength"`

## Recommendation

Proceed to tracker/backlog alignment. The next planning task should choose
between another scalar/texture fidelity fixture, a broader combined PBR fixture,
or a route diagnostics cleanup if new route friction appears.
