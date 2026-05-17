# Scalar Unlit Prepared Cache Boundary Audit - 2026-05-17

## Scope

Audit the scalar unlit prepared material cache added after the app-local
material resource and unlit scalar cache plans.

This audit covers:

- `packages/webgpu/src/webgpu/prepared-unlit-material-cache.ts`
- `packages/webgpu/src/webgpu/unlit-frame-resources.ts`
- `packages/webgpu/src/webgpu/unlit-app-frame-resources.ts`
- WebGPU app route ownership in `packages/webgpu/src/webgpu/app.ts`
- focused scalar cache and app reuse tests

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/RENDER_ASSET_PREPARATION.md`
- `docs/research/APP_LOCAL_MATERIAL_RESOURCE_RENDER_WORLD_AUDIT_2026_05_17.md`
- `docs/research/UNLIT_SCALAR_PREPARED_MATERIAL_CACHE_PLAN_2026_05_17.md`
- `packages/render/src/materials/prepared-resource.ts`
- `packages/webgpu/src/webgpu/prepared-unlit-material-cache.ts`
- `packages/webgpu/src/webgpu/unlit-frame-resources.ts`
- `packages/webgpu/src/webgpu/unlit-app-frame-resources.ts`
- `packages/webgpu/src/webgpu/app.ts`
- `test/webgpu/prepared-unlit-material-cache.test.ts`
- `test/webgpu/webgpu-app.test.ts`

## Findings

No ECS/render/WebGPU ownership violation was found.

The scalar unlit prepared cache is WebGPU-private and app-owned during the proof
point. It stores WebGPU backend resources only:

- scalar unlit material uniform buffer;
- group-2 material bind group;
- source material key/version;
- pipeline key;
- group-2 layout key;
- stable resource keys for diagnostics and frame planning.

The cache still derives its stable material identity from the render-layer
`PreparedMaterialResourceDescriptor`. That keeps the render package as the
renderer-independent descriptor owner while raw GPU buffers and bind groups stay
inside `@aperture-engine/webgpu`.

Frame-owned resources remain outside prepared material state:

- mesh buffers are still frame/app resources;
- view uniform buffers are still frame/snapshot resources;
- world transform buffers are still frame/snapshot resources;
- Standard light buffers and light bind groups are untouched;
- texture and sampler dependencies are explicitly skipped by the scalar cache.

The app facade owns the cache lifetime. There are no module-global caches and no
public material plugin API.

## Risks And Follow-Ups

The current app tests cover unchanged-frame reuse and direct scalar cache
create/reuse/invalidation. They do not yet force a frame-resource cache miss
while keeping the scalar material source version unchanged, so `task-0803`
should add that focused regression before the cache grows more responsibilities.

Texture/sampler handoff remains intentionally deferred. `task-0804` should plan
dependency handle/version keys and diagnostics before textured unlit materials
use the prepared cache.

Mesh GPU buffers still live in frame-resource helpers. This is acceptable for
the scalar material slice, but `task-0806` should plan the separate prepared
mesh cache so material caching does not accidentally become a broad frame
resource cache.

## Validation

- `pnpm exec vitest run test/webgpu/prepared-unlit-material-cache.test.ts test/webgpu/webgpu-app.test.ts test/webgpu/unlit-bind-group.test.ts test/webgpu/unlit-material-buffer-resource.test.ts`
- `pnpm exec vitest run test/webgpu/prepared-unlit-material-cache.test.ts test/webgpu/webgpu-app.test.ts test/webgpu/light-packing.test.ts test/webgpu/view-uniform-buffer.test.ts test/webgpu/world-transform-buffer.test.ts`
- `pnpm exec tsc --noEmit -p packages/webgpu/tsconfig.json`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
