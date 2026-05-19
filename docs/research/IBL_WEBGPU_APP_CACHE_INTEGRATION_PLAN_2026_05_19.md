# IBL WebGPU App Cache Integration Plan — 2026-05-19

## Task

Completed `task-1838` as a cache-path plan. Direct implementation would touch
the private `createWebGpuApp()` resource cache and the public app facade shape,
so this run records the narrow integration design instead of exposing cache
internals prematurely.

## Reference Anchors

- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/app-texture-sampler-resources.ts`
- `packages/webgpu/src/webgpu/ibl-texture-resource.ts`
- `packages/webgpu/src/webgpu/ibl-sampler-resource.ts`
- `docs/research/LIVE_IBL_RESOURCE_CACHE_DIRECTION_AUDIT_2026_05_19.md`

## Existing Cache Pattern

`createWebGpuApp()` owns a private `WebGpuAppResourceCache` with:

- `textures: Map<string, TextureGpuResource>`;
- `samplers: Map<string, SamplerGpuResource>`;
- prepared mesh/material caches;
- per-family frame-resource slots; and
- a forward depth attachment cache.

Material texture/sampler resources use source asset version keys through
`sourceAssetCacheKey(handle, version)`. That is correct for material-bound
`TextureAsset` and `SamplerAsset` inputs.

IBL resources differ because they are environment-derived renderer resources:

- diffuse irradiance texture resources are derived from environment-map
  descriptors;
- specular prefilter textures will be produced by renderer passes;
- IBL samplers are derived from IBL descriptor readiness; and
- environment invalidation should be keyed by environment resource identity and
  preparation role, not by a material texture asset handle.

## Integration Direction

Do not expose the private app resource cache on `WebGpuApp`.

Instead, add an internal `environmentResources` cache slot to
`WebGpuAppResourceCache` once bind-group resources are ready to consume IBL
inputs. The first implementation should be a focused helper that can also be
unit-tested outside the app facade:

```ts
interface WebGpuEnvironmentResourceCache {
  diffuseTextures: Map<string, TextureGpuResource>;
  specularTextures: Map<string, TextureGpuResource>;
  samplers: Map<string, SamplerGpuResource>;
}
```

Suggested cache keys:

- `environment-map:<id>:diffuse-ibl@<descriptorVersion>`;
- `environment-map:<id>:specular-prefilter@<descriptorVersion>`;
- `environment-map:<id>:ibl-sampler@<samplerDescriptorVersion>`.

## Acceptance For Follow-Up Implementation

- Add an internal WebGPU environment resource cache without exposing it on the
  public app object.
- Teach the IBL texture/sampler resource helpers to reuse matching cached
  resources and report created/reused counts.
- Replace the GLTF scene module-scope `??=` caching with a call path that uses
  renderer-owned cache state.
- Keep JSON helpers free of raw GPU handles.

## Deferred

- Public app-owned cache APIs.
- Specular prefilter pass execution.
- IBL bind-group resource creation.
- WGSL IBL sampling.
