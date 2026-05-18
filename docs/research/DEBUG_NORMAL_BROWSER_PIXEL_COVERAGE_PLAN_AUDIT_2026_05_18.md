# DebugNormal Browser Pixel Coverage Plan Audit

Date: 2026-05-18

## Scope

Audit the selected DebugNormalMaterial browser pixel coverage plan.

## References Inspected

- `docs/research/DEBUG_NORMAL_BROWSER_PIXEL_COVERAGE_PLAN_2026_05_18.md`
- `docs/research/DEBUG_NORMAL_APP_ROUTE_INTEGRATION_AUDIT_2026_05_18.md`
- `docs/ARCHITECTURE.md`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`
- `packages/webgpu/src/webgpu/debug-normal-shader.ts`

## Findings

- The selected follow-up is concrete enough for one focused implementation run:
  add one browser example, one Playwright spec, and status assertions over the
  existing app route.
- The plan preserves ECS authority because authoring remains mesh/material
  components and typed source assets; browser rendering still consumes extracted
  snapshots and renderer-owned WebGPU resources.
- The plan keeps WebGPU ownership isolated to `@aperture-engine/webgpu` and
  does not add GLB loading, IBL, shadows, a scene graph, or cross-slot prepared
  DebugNormal material caching.
- The pixel assertion should use a stable camera/cube orientation and sample a
  known face color. It should also assert JSON-safe status so the browser
  fixture proves diagnostics/readiness surfaces as well as pixels.

## Recommendation

Implement the browser fixture and Playwright regression next as `task-1406`.
