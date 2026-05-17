# Texture/Sampler Dependency Preparation Helper Plan

Date: 2026-05-17

Task: `task-1030`

## Context

`prepareQueuedBuiltInFrameResources()` still directly performs built-in
texture/sampler dependency preparation:

```ts
const textureSamplerDependencies =
  createPreparedMaterialTextureSamplerDependencies(
    adapter.prepareTextureSamplerResources(...)
  );
```

This is the next small step toward making the built-in app route read like a
generic material-family preparation pipeline.

## Reference Anchors Inspected

- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/app-texture-sampler-resources.ts`
- `packages/webgpu/src/webgpu/prepared-material-texture-sampler-dependencies.ts`
- `packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts`
- `packages/render/src/materials/dependency-readiness.ts`

## Recommended Slice

Add a named helper in `app.ts`:

```ts
prepareQueuedBuiltInTextureSamplerDependencies({
  adapter,
  app,
  cache,
  item,
  reuse,
});
```

The helper should:

- call `adapter.prepareTextureSamplerResources(...)`;
- wrap the result with `createPreparedMaterialTextureSamplerDependencies(...)`;
- return the same `PreparedMaterialTextureSamplerDependencies` shape already
  used by frame-resource creation.

This is a pure extraction. It should not change diagnostics, resource creation,
texture upload, sampler creation, or app report behavior.

## Non-Goals

- Do not move dependency preparation out of the app route yet.
- Do not change texture/sampler cache behavior.
- Do not alter material dependency readiness diagnostics.
- Do not add successful route shells or new app report fields.

## Implementation Follow-Up

Proceed with `task-1031`:

- Extract the helper in `packages/webgpu/src/webgpu/app.ts`.
- Use it in `prepareQueuedBuiltInFrameResources()`.
- Run targeted `frameResourceRoute` and mixed built-in app route tests plus
  WebGPU typecheck.
