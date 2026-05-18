# Next Route Or Standard After Route Shell Plan Audit

Date: 2026-05-18

Task: `task-1667`

## Scope

Audit the plan selecting a metallic-roughness factor texture shader contract
regression after non-built-in route shell coverage.

Reference files inspected:

- `docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_ROUTE_SHELL_PLAN_2026_05_18.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/ARCHITECTURE.md`
- `packages/webgpu/src/webgpu/standard-shader.ts`
- `test/webgpu/standard-shader.test.ts`
- `references/three.js/src/materials/MeshStandardMaterial.js`
- `references/three.js/src/renderers/webgl/WebGLMaterials.js`
- `references/engine/src/scene/materials/standard-material.js`

## Findings

- The selected follow-up is concrete enough for one focused run and stays in
  shader contract test coverage.
- It is aligned with the medium-term StandardMaterial priority: glTF-style
  metallic-roughness support should remain well specified before broader PBR
  work.
- It does not change app routing, public material source APIs, examples,
  browser fixtures, IBL, shadows, or non-built-in adapter registration.
- It preserves WebGPU backend ownership because it validates generated WGSL
  source and shader metadata only; no GPU resources are created.
- It preserves ECS/render boundaries because no ECS state or render extraction
  behavior is touched.

## Recommendation

Implement `task-1668` as planned. If the regression exposes a shader defect,
keep the fix scoped to the metallic-roughness texture factor expressions and
run the focused shader tests plus typecheck.
