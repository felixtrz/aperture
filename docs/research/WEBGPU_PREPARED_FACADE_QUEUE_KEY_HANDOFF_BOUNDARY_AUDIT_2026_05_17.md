# WebGPU Prepared Facade Queue-Key Handoff Boundary Audit - 2026-05-17

## Scope

Audit the first WebGPU app material queue pass after routing material resource
key resolution through `PreparedMaterialStore` facade descriptors.

This audit checks ownership and package boundaries only.

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/research/WEBGPU_APP_QUEUE_FACADE_KEY_HANDOFF_PLAN_2026_05_17.md`
- `packages/render/src/rendering/prepared-material-queue-resolver.ts`
- `packages/render/src/rendering/snapshot-prepared-materials.ts`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/prepared-app-material-resource.ts`
- `test/webgpu/webgpu-app.test.ts`
- `references/bevy/crates/bevy_render/src/render_asset.rs`
- `references/bevy/crates/bevy_pbr/src/material.rs`
- `references/engine/src/platform/graphics/bind-group.js`
- `references/engine/src/platform/graphics/webgpu/webgpu-bind-group.js`
- `references/three.js/src/renderers/common/Bindings.js`
- `references/three.js/src/renderers/common/RenderObjects.js`

## Result

No corrective refactor is needed.

The handoff keeps the intended split:

- The WebGPU app prepares `resourceCache.preparedMaterialFacade` before queued
  built-in resource collection.
- The first `writeMaterialQueueFromSnapshot()` material resolver now comes from
  `createPreparedMaterialQueueResourceKeyResolver()`.
- The render package still only produces logical keys such as
  `prepared-material:*` and `prepared-material-bind-group:*`.
- WebGPU material buffers, bind groups, textures, samplers, pipeline layouts,
  pipelines, light buffers, command encoding, and submission remain in
  `@aperture-engine/webgpu`.
- The second queue pass still resolves concrete backend resource keys from the
  prepared WebGPU resources before frame-plan assembly.

## Validation

- `node scripts/check-package-boundaries.mjs` passed.
- `pnpm exec vitest run test/webgpu/webgpu-app.test.ts test/rendering/material-queue.test.ts`
  passed before this audit.
- `pnpm exec vitest run test/rendering/snapshot-prepared-materials.test.ts test/webgpu/webgpu-app.test.ts test/rendering/material-queue.test.ts`
  passed after facade pruning and app regression work.
- `pnpm exec tsc --noEmit -p packages/webgpu/tsconfig.json` and
  `pnpm exec tsc --noEmit -p tsconfig.test.json` passed.

## Drift Check

The implementation remains aligned with the architecture docs:

- `@aperture-engine/render` does not import WebGPU.
- The app facade consumes snapshots and prepared render metadata; it does not
  become authoritative ECS state or a hidden scene graph.
- Facade keys are JSON-safe descriptor identities, not raw backend handles.
- Backend cache counts, texture/sampler counters, and facade summaries remain
  separate.

## Remaining Risk

The first material queue pass now uses prepared material facade keys, but mesh
resource keys still come from source mesh asset cache keys. That is intentional
until a matching prepared mesh facade exists.

Backend prepared material cache eviction remains separate future work. Facade
pruning now keeps report and queue metadata snapshot-scoped, but WebGPU cache
entries still use backend retention semantics.
