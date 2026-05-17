# Prepared Route Counter Boundary Audit - 2026-05-17

## Scope

Audit the app-route prepared mesh/material counters and the current scalar
unlit, textured unlit, and Matcap prepared-resource paths before extending the
same mesh-cache pattern to StandardMaterial.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/RENDER_ASSET_PREPARATION.md`
- `docs/research/TEXTURED_UNLIT_AND_MESH_CACHE_BOUNDARY_AUDIT_2026_05_17.md`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/unlit-app-frame-resources.ts`
- `packages/webgpu/src/webgpu/matcap-app-frame-resources.ts`
- `packages/webgpu/src/webgpu/prepared-mesh-cache.ts`
- `packages/webgpu/src/webgpu/prepared-unlit-material-cache.ts`
- `test/webgpu/webgpu-app.test.ts`

## Findings

- Prepared route counters are JSON-safe scalar report fields. They expose
  creation/reuse counts for prepared mesh buffers, prepared material buffers,
  and prepared material bind groups, but not cache maps, descriptors, raw
  buffers, raw bind groups, textures, samplers, or views.
- Full frame-resource cache hits remain distinguishable from prepared-resource
  reuse. Cache-hit paths increment the existing frame-resource reuse counters
  and dynamic writes, while frame-resource misses that consume prepared resources
  increment the prepared counters.
- Scalar unlit and Matcap prepared mesh paths are derived from source mesh
  handle/version plus upload layout. They do not cache ECS entities,
  transforms, view uniforms, material data, light resources, draw queues, or app
  lifecycle state.
- Textured unlit prepared material cache keys include source material
  handle/version, pipeline key, group-2 layout key, and texture/sampler
  dependency source versions. Texture and sampler GPU resources stay in
  `packages/webgpu` and are still derived from ready source assets.
- The render and simulation packages do not import WebGPU. Boundary validation
  passed after the counter additions.

## Follow-Up Guardrails

- `task-0816` should wire only prepared mesh resources into the StandardMaterial
  app route. Standard material buffers, texture resources, light buffers, and
  light bind groups should remain on the current Standard path for that slice.
- `task-0817` should extract shared prepared mesh lookup logic only after
  Standard uses the same behavior, so the helper can be validated against all
  three material-family routes.
- `task-0818` should plan StandardMaterial prepared material caching before
  code changes because Standard texture and light-resource ownership is broader
  than unlit group-2 material ownership.

## Outcome

No boundary drift was found. Existing follow-up task wording already constrains
StandardMaterial work to prepared mesh resources first, then a shared helper,
then a separate StandardMaterial prepared material plan.
