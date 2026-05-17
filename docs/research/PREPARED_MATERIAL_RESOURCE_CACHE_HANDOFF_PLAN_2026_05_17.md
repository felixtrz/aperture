# Prepared Material Resource Cache Handoff Plan - 2026-05-17

## Scope

Plan the next handoff from app-local built-in material frame resources toward a
renderer/WebGPU prepared material resource cache.

This is a planning slice only. It does not change implementation.

## References Inspected

- `docs/RENDER_ASSET_PREPARATION.md`
- `docs/ARCHITECTURE.md`
- `docs/research/APP_LOCAL_RESOURCE_ADAPTER_SPLIT_PLAN_2026_05_17.md`
- `docs/research/APP_FRAME_RESOURCE_HOT_PATH_ALLOCATION_PLAN_2026_05_17.md`
- `packages/render/src/materials/prepared-resource.ts`
- `packages/render/src/assets/preparation.ts`
- `packages/webgpu/src/webgpu/app-texture-sampler-resources.ts`
- `packages/webgpu/src/webgpu/unlit-app-frame-resources.ts`
- `packages/webgpu/src/webgpu/matcap-app-frame-resources.ts`
- `packages/webgpu/src/webgpu/standard-app-frame-resources.ts`
- `packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts`
- `references/three.js/src/renderers/webgl/WebGLRenderLists.js`
- `references/engine/src/scene/layer.js`

## Current Boundary

The render package already has a renderer-independent material preparation
contract:

```text
source MaterialAsset
  -> PreparedMaterialResourceDescriptor
  -> PreparedMaterialAssetStore metadata
```

That descriptor records source material identity, material family, pipeline key,
logical material/bind-group resource keys, texture/sampler binding keys, and
dependency readiness without exposing WebGPU handles.

The WebGPU app still turns each queued draw into app-local GPU resources:

```text
queued draw item
  -> prepare app texture/sampler resources
  -> create/reuse family frame resources
  -> append family buckets
  -> render frame plan
```

This is acceptable for the proof point, but it means material GPU buffers,
material bind groups, and texture/sampler dependency preparation are coupled to
the app frame route rather than a prepared material resource cache.

## Handoff Direction

Use the render metadata descriptor as the stable source-of-truth contract and
add a WebGPU-owned prepared material resource layer behind the app facade.

Target shape:

```text
PreparedMaterialResourceDescriptor
  -> WebGpuPreparedMaterialResource
  -> queued app/render-world resource lookup
  -> frame resource assembly
```

The prepared WebGPU resource should own backend objects only:

- material uniform buffer;
- material bind group;
- prepared texture/sampler resource references or keys;
- pipeline key and bind group layout key used to create the bind group;
- source material key and source version used for invalidation;
- dependency keys and dependency versions used to decide reuse vs retry.

The render package should continue to own only source metadata and logical
resource keys. It must not import WebGPU types or raw backend handles.

## Suggested Incremental Stages

### 1. Add an internal prepared material cache type

Add a private WebGPU module for built-in material prepared resources. Initial
scope should be narrow:

- source material key;
- source material version;
- pipeline key;
- material resource key;
- bind group resource key;
- texture/sampler dependency keys;
- per-family prepared resource payload.

Keep cache construction owned by `createWebGpuApp` or a future render-world
resource owner. Do not use module-global caches.

### 2. Prepare one family through the cache

Start with unlit scalar materials because they avoid texture/sampler and light
dependencies. The frame-resource helper should consume a prepared material
buffer/bind group record instead of creating the material buffer on every cache
miss.

Acceptance for this stage should prove:

- source material changes invalidate the prepared material resource;
- second frames reuse the prepared material resource;
- app frame reports remain JSON-safe;
- route diagnostics remain unchanged.

### 3. Add texture/sampler dependency handoff

Move texture/sampler dependency preparation behind the prepared material cache
after scalar unlit is stable. The cache should key by logical dependency keys
and dependency source versions, not by raw texture/sampler object identity.

Texture and sampler GPU resources may stay in the existing WebGPU app caches at
first. The prepared material record can reference their stable resource keys and
backend handles without making source assets renderer-owned.

### 4. Extend to Matcap and StandardMaterial

Matcap can follow once texture/sampler dependency handoff is stable.

StandardMaterial should follow after light buffers remain clearly frame-owned:

- material buffer and material bind group can be prepared/cached by material;
- view, transform, and light buffers stay frame resources;
- light bind groups stay frame-dependent until a separate light resource cache
  exists.

### 5. Move lookup toward render-world resource resolution

Once built-in prepared material resources are cached outside the immediate app
route, queued draw planning should resolve logical material resource keys
against prepared WebGPU resources instead of building resources inline.

This moves the architecture closer to:

```text
ECS/source assets -> render metadata -> prepared backend resources -> frame plan
```

without requiring a public plugin API.

## Ownership Rules

- Source material assets remain in typed asset collections and `AssetRegistry`.
- Render metadata descriptors remain in `@aperture-engine/render`.
- WebGPU buffers, bind groups, textures, samplers, and pipelines remain in
  `@aperture-engine/webgpu`.
- The app facade may own the cache during the proof point, but the cache shape
  should be compatible with future render-world ownership.
- Invalidation should use source handle keys, source versions, pipeline keys,
  and dependency readiness/version keys.

## Non-Goals

- Do not introduce a public material plugin API in this slice.
- Do not move view, world-transform, or light buffers into material prepared
  resources.
- Do not make WebGPU resources the source of material truth.
- Do not add WebGL fallback or a mutable renderer scene graph.
- Do not move this into the render package if it needs raw WebGPU handles.

## Proposed Follow-Up Tasks

### Plan unlit scalar prepared material cache slice

Category: `webgpu-render`
Package/write-scope: `docs/research`, with read-only inspection of unlit
material buffer/bind group helpers and app frame-resource helpers.
Reference anchor: this plan, `docs/RENDER_ASSET_PREPARATION.md`, and
`packages/render/src/materials/prepared-resource.ts`.

Acceptance criteria:

- The plan defines the smallest unlit scalar prepared material cache contract.
- The plan identifies invalidation keys and report fields.
- The plan keeps view/transform buffers frame-owned.

### Add internal prepared material cache for scalar unlit

Category: `webgpu-render`
Package/write-scope: `packages/webgpu/src/webgpu`, focused WebGPU app tests.
Reference anchor: the unlit scalar prepared cache plan, existing unlit material
buffer/bind group helpers, and current app cache-slot tests.

Acceptance criteria:

- Scalar unlit material buffer and bind group preparation can be cached by
  source material version and pipeline key.
- The app route consumes the prepared material resource without changing public
  app APIs.
- Tests cover first-frame create, second-frame reuse, and source material
  invalidation.
