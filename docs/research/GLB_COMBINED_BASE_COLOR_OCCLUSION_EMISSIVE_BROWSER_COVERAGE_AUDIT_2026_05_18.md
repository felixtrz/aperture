# GLB Combined Base Color Occlusion Emissive Browser Coverage Audit - 2026-05-18

## Scope

Audited the `task-1444` browser coverage for a GLB-shaped StandardMaterial with
base-color, occlusion, and emissive textures active together.

Reference anchors inspected:

- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md` decision 0010
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`

## Findings

- The fixture uses the existing inline glTF source, ECS-authored app setup, and
  built-in StandardMaterial route.
- The browser test verifies all three texture/sampler mappings, readiness slots,
  prepared texture/sampler resource counts, the combined pipeline key, and
  non-clear screenshot/readback pixels.
- Status assertions remain JSON-safe and do not expose source asset payloads or
  raw GPU handles.
- The slice does not introduce app-level generic adapter rendering, IBL, shadows,
  binary GLB loading, or broad PBR expansion.

## Validation

- `node --check examples/standard-gltf-texture.js`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts -g "combined base-color occlusion and emissive"`
