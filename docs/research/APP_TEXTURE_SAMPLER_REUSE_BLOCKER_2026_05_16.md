# App Texture/Sampler Reuse Diagnostics Blocker

Date: 2026-05-16

## Scope

This note resolves `task-0577` by checking whether app render reports can
truthfully distinguish created/reused texture and sampler GPU resources today.

Reference anchors:

- Bevy render asset preparation and retry/cache patterns in
  `references/bevy/crates/bevy_render/src/render_asset.rs`.
- Bevy material preparation and bind-group readiness in
  `references/bevy/crates/bevy_pbr/src/material.rs`.
- Existing Aperture WebGPU resource summary JSON helpers.
- Lower-level unlit textured frame resource tests.

## Finding

Texture and sampler resource reuse is not active at the `createWebGpuApp.render()`
facade yet.

Lower-level WebGPU modules already have the pieces needed after resources are
prepared:

- `createTextureGpuResource()` creates texture/view resources from a descriptor.
- `createSamplerGpuResource()` creates sampler resources from source sampler
  assets.
- `createUnlitFrameGpuResources()` can accept prepared texture and sampler
  resources and bind them for textured unlit materials.
- Resource summary JSON helpers already serialize texture/sampler diagnostics
  without raw GPU handles.

The app facade still lacks the source-to-prepared bridge:

- It does not scan the current material's texture/sampler dependencies and
  prepare corresponding GPU resources.
- It does not cache prepared texture/sampler resources by stable source handle
  and asset version.
- It does not pass prepared texture/sampler resources into
  `createUnlitFrameGpuResources()`.
- Texture source assets currently carry metadata, not uploaded pixel payloads,
  so the first app slice should either create descriptor-only placeholder
  resources or add a narrow upload payload contract before browser texture
  rendering claims real image support.

Adding reuse counters before that bridge exists would be misleading because the
counters would always remain zero in app reports even for textured materials.

## Decision

Do not add texture/sampler reuse counters to `WebGpuAppResourceReuseReport` yet.
First add the app-facade prepared-resource cache for material texture/sampler
dependencies, then report created/reused counts from that cache.

This matches the Bevy-aligned pattern: source assets are extracted/validated,
then render-owned prepared assets are created, cached, reused, and referenced by
material bind-group preparation.
