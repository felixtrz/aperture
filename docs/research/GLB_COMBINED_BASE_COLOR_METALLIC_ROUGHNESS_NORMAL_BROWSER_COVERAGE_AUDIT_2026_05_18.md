# GLB Combined Base Color Metallic Roughness Normal Browser Coverage Audit - 2026-05-18

## Scope

Audited the `task-1441` browser coverage for a GLB-shaped StandardMaterial with
base-color, metallic-roughness, and normal textures active together.

Reference anchors inspected:

- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md` decision 0010
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`

## Findings

- The new scenario reuses the existing ECS-authored app path and inline glTF
  fixture. It does not add a scene graph, renderer-owned source state, or a
  backend fallback.
- The fixture registers three texture/sampler mappings: base-color,
  metallic-roughness, and normal. The app report verifies all three readiness
  slots and creates three WebGPU texture/sampler resources.
- The normal path uses the existing tangent mesh helper and asserts the tangent
  mesh-layout key alongside the combined StandardMaterial pipeline key.
- The browser test checks JSON-safe status, no diagnostics, screenshot/readback
  pixels, and the combined route/resource report without exposing raw GPU
  handles.

## Validation

- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts -g "combined base-color metallic-roughness and normal"`

## Follow-Up

Run the full StandardMaterial texture E2E file and broad validation before the
final stop hook.
