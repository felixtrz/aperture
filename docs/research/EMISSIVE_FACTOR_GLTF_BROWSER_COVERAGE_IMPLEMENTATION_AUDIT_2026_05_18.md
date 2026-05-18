# Emissive-Factor glTF Browser Coverage Implementation Audit

Date: 2026-05-18

Task: `task-1593`

## Scope

Audit the `task-1592` implementation of glTF-shaped StandardMaterial
`emissiveFactor` browser coverage without an `emissiveTexture`.

## Findings

- The new `emissive-factor` scenario authors a StandardMaterial with
  `emissiveFactor` and no texture slot.
- Browser status reports zero mapped textures, zero mapped samplers, zero
  texture GPU resources, zero sampler GPU resources, and the scalar
  `standard|opaque|back|less|none` pipeline.
- `standardMaterial.expectedEmissive` exposes the expected factor in JSON-safe
  status without source texture payloads or GPU handles.
- Playwright verifies screenshot/readback samples differ from clear color.

## Boundary Check

- The implementation stays in `examples/standard-gltf-texture.js` and
  `test/e2e/standard-gltf-texture.spec.ts`.
- It does not alter material mapping policy, route traversal, prepared-resource
  lifetime, StandardMaterial shader code, binary GLB loading, IBL, shadows, or
  app-level non-built-in rendering.
- ECS authority and render extraction boundaries remain unchanged.

## Validation

- `node --check examples/standard-gltf-texture.js`
- `pnpm run typecheck:test`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts -g "emissive factor"`

## Recommendation

Proceed to tracker/backlog alignment. The next planning slice should compare a
route/prepared-resource cleanup against any remaining small StandardMaterial
fidelity gap before adding broader PBR work.
