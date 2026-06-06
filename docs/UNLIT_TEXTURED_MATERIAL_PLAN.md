# Texture-Backed Unlit Material Plan

Status: implemented

This document defines the smallest texture-backed unlit slice that preserves
Aperture's ECS/render boundary.

## Boundary

- ECS render authoring stores only asset handles through the `Mesh` and
  `Material` components.
- `UnlitMaterialAsset.baseColorTexture` remains material data, not GPU state.
  It may reference a `TextureHandle` and `SamplerHandle`.
- `TextureAsset` and `SamplerAsset` live in the asset registry with normal
  `registered`, `loading`, `ready`, and `failed` states.
- Render extraction resolves mesh and material assets. It should also validate
  texture and sampler handle availability for ready unlit materials before
  emitting a mesh draw packet that requires textured resources.
- The renderer owns `GPUTexture`, `GPUTextureView`, and `GPUSampler` resources.
  ECS components, snapshots, and browser status payloads must not serialize
  those handles.
- Render-world resource binding should bind texture and sampler resource keys
  alongside the material resource key when the unlit material declares a
  texture.

## Minimal WebGPU Slice

- Add texture upload planning for a small CPU-backed `TextureAsset` payload or
  a browser example fixture that creates a 1x1/2x2 GPU texture resource from
  known RGBA bytes.
- Add sampler resource creation from `SamplerAsset`.
- Extend unlit bind group 2 so the textured variant can include:
  - material uniform buffer
  - base-color texture view
  - base-color sampler
- Add an unlit shader feature flag for `baseColorTexture` and include it in the
  material pipeline key.
- Keep the current factor-only unlit path as the fallback when
  `baseColorTexture` is `null`.
- Publish JSON-safe resource counts and diagnostic codes in browser status, not
  raw WebGPU handles.

## Diagnostics

- Missing texture or sampler handles inside a ready unlit material should be
  extraction diagnostics because the material asset is not renderable as
  authored.
- Loading or failed texture/sampler asset states should also be extraction
  diagnostics for the first slice. This keeps zero-submission behavior aligned
  with existing mesh/material asset status scenarios.
- Missing renderer-side GPU texture, texture view, or sampler bindings after
  successful extraction should be resource-binding or draw-list diagnostics,
  matching the existing missing mesh/material resource smoke tests.
- Diagnostic payloads should include stable asset keys and messages only.

## Browser Scenario

The first browser scenario should render a single plane with a tiny
texture-backed unlit material. Readback should sample two pixels with different
UVs so the test proves texture sampling, not just material fallback color. The
status payload should report texture/sampler asset status, resource counts,
draw counts, and readback samples.

## Follow-Up Tasks

Add implementation tasks for:

- texture and sampler GPU resource creation helpers
- textured unlit bind group layout/resource planning
- unlit shader and pipeline key feature flag for base color textures
- extraction diagnostics for missing/loading/failed texture and sampler assets
- browser readback coverage for a texture-backed unlit plane
