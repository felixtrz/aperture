# App-Local Material Resource Render-World Audit - 2026-05-17

## Scope

Audit the current WebGPU app-local material resource path against Aperture's
longer-term render-world and prepared-resource direction.

This is an audit slice only. It does not change implementation behavior.

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/RENDER_ASSET_PREPARATION.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/PREPARED_MATERIAL_RESOURCE_CACHE_HANDOFF_PLAN_2026_05_17.md`
- `docs/research/APP_FRAME_RESOURCE_HOT_PATH_ALLOCATION_PLAN_2026_05_17.md`
- `packages/render/src/materials/prepared-resource.ts`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/app-texture-sampler-resources.ts`
- `packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts`
- `packages/webgpu/src/webgpu/unlit-app-frame-resources.ts`
- `packages/webgpu/src/webgpu/matcap-app-frame-resources.ts`
- `packages/webgpu/src/webgpu/standard-app-frame-resources.ts`
- `packages/webgpu/src/webgpu/unlit-frame-resources.ts`
- `packages/webgpu/src/webgpu/standard-frame-resources.ts`
- `references/bevy/crates/bevy_render/src/erased_render_asset.rs`
- `references/three.js/src/renderers/webgpu/utils/WebGPUBindingUtils.js`
- `references/engine/src/scene/layer.js`

## Reference Pattern

The common useful pattern is not a public material plugin API. It is a staged
resource lifetime:

```text
source asset/version
  -> renderer-readable prepared descriptor
  -> backend-owned GPU resource cache
  -> frame queue / bind group / draw submission
```

Bevy separates extracted source assets from prepared render assets and removes
old prepared entries before replacing them. three.js' WebGPU binding utility
caches bind group layouts by descriptor shape and bind groups by cache index and
version. PlayCanvas keeps stable render-layer lists and sorting state separate
from material shader variant invalidation.

Aperture should adapt the lifetime and invalidation idea while keeping its
worker-friendly `RenderSnapshot`, typed source assets, and WebGPU-only backend.

## Current Aperture Path

The current app path is coherent for the proof point:

```text
RenderSnapshot mesh draw
  -> built-in material route adapter
  -> app-local texture/sampler preparation
  -> app-local family frame resource helper
  -> render frame plan
  -> WebGPU command submission
```

Current app-owned caches include:

- pipeline cache keyed by material family, color format, and pipeline key;
- pipeline layout cache keyed by material family and pipeline resource key;
- texture and sampler caches keyed by source handle plus source version;
- one frame-resource cache slot each for unlit, Matcap, and StandardMaterial;
- queue-route scratch maps and buckets for the built-in material queue.

The render package already defines a renderer-independent
`PreparedMaterialResourceDescriptor` with source material key, family, pipeline
key, logical material and bind group resource keys, dependency keys, texture
bindings, and dependency readiness. The WebGPU app does not yet consume that
descriptor as the handoff into backend-owned prepared material resources.

## What Should Stay App-Local For Now

These pieces should remain in `createWebGpuApp` or app-owned helper modules for
the proof point:

- app lifecycle, device/context ownership, command submission, and
  `waitForSubmittedWork`;
- pipeline selection and pipeline/layout cache lifetime;
- view uniform and world transform buffers, because they are frame/snapshot
  data rather than material assets;
- Standard light buffers and light bind groups, because they are derived from
  frame light packets and should not be cached as material resources;
- render frame plan scratch, material queue scratch, route report shell, and
  resource reuse counters;
- texture and sampler GPU resource caches until the first scalar material cache
  proves the invalidation/reporting shape.

Keeping these app-local avoids creating a premature render-world API while the
proof-point app facade is still carrying orchestration.

## What Should Move Toward Prepared Resources

The next handoff should be narrow and internal:

- material uniform buffers should be prepared by source material handle,
  source version, family, and pipeline key;
- material bind groups should be prepared from the logical
  `PreparedMaterialResourceDescriptor` keys and the selected layout key;
- texture/sampler dependency keys should become prepared-material dependency
  inputs after scalar unlit is stable;
- Matcap and StandardMaterial should reuse the same prepared-material cache
  shape only after the texture/sampler handoff is explicit;
- mesh GPU buffers should eventually move to a prepared mesh cache, but that is
  a separate track from the immediate material-resource cleanup.

The cache should be app-owned in the short term and shaped so a future
render-world resource owner can take it over without changing public app APIs.

## Boundary Risks Found

No current code violates the North Star boundaries:

- ECS remains authoritative.
- WebGPU resources are not stored on ECS components or render package
  descriptors.
- The built-in app resource adapter is private to the WebGPU package.
- No public mutable scene graph or WebGL fallback is introduced.

The main risks are architectural drift risks rather than current violations:

- Material buffers and material bind groups are still created through
  frame-resource helpers, so material resource lifetime is coupled to the app
  frame route.
- Per-family frame cache slots only remember one current source combination,
  which is acceptable for proof-point reuse but is not a general prepared asset
  store.
- `PreparedMaterialResourceDescriptor` is currently parallel metadata rather
  than the WebGPU resource lookup input, so queue/resource planning can drift
  away from render-layer preparation contracts if the next slices bypass it.
- Texture/sampler caches already use source versions, but they are prepared
  directly from material assets instead of through material dependency
  descriptors.

## Follow-Up Task Adjustments

The existing follow-up sequence is still appropriate:

1. Add descriptor-plan scratch writers for view and transform buffers.
2. Add StandardMaterial light-pack scratch.
3. Reuse app frame-resource success shells.
4. Plan scalar unlit prepared material caching.
5. Add scalar unlit prepared material caching.

The prepared material cache tasks should explicitly use this audit and
`PreparedMaterialResourceDescriptor` as anchors. They should not introduce a
public material plugin API, should not move frame buffers into material
resources, and should not make WebGPU resources authoritative source state.

## Validation

Documentation-only audit. Run `pnpm run format:check` after updating backlog and
handoff files.
