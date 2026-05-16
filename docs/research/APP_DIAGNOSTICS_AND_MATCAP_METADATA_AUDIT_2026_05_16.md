# App Diagnostics And Matcap WebGPU Boundary Audit

Date: 2026-05-16

## Scope

Focused audit after `task-0584`, `task-0585`, `task-0580`, `task-0581`,
`task-0582`, `task-0587`, `task-0588`, `task-0589`, and `task-0590`.

Checked:

- App-facade unlit texture/sampler prepared-resource cache.
- App resource reuse counters and JSON report helper.
- Matcap shader metadata, material buffer preparation, group-2 bind group
  resources, pipeline resource creation, and frame-resource assembly.
- Browser-facing app diagnostics example.
- Package dependency direction for `simulation`, `render`, and `webgpu`.

## Reference Anchors

- Bevy render asset preparation cache and retry model:
  `references/bevy/crates/bevy_render/src/render_asset.rs`.
- Bevy material preparation/bind group readiness:
  `references/bevy/crates/bevy_pbr/src/material.rs`.
- Three.js matcap UV and shader pattern:
  `references/three.js/src/nodes/utils/MatcapUV.js` and
  `references/three.js/src/renderers/shaders/ShaderLib/meshmatcap.glsl.js`.
- PlayCanvas/WebGPU texture resource and sampler patterns:
  `references/engine/src/platform/graphics/texture.js` and
  `references/engine/src/platform/graphics/webgpu/webgpu-texture.js`.

## Findings

- ECS/render ownership remains intact. `simulation` and `render` still do not
  import `webgpu`, browser globals, or renderer-owned GPU resource types.
- The new app texture/sampler cache is WebGPU-owned and keyed by
  `assetHandleKey(handle)@sourceVersion`. ECS components still store stable
  source handles only.
- The unlit app frame cache now includes versioned texture and sampler cache
  keys before reusing bind groups. This prevents stale bind group reuse after a
  dependency asset version changes.
- `WebGpuAppRenderReport` remains the rich runtime object, while
  `webGpuAppRenderReportToJsonValue()` intentionally omits `snapshot`,
  pipeline handles, prepared resource handles, bind groups, command buffers, and
  browser/WebGPU objects.
- Matcap WebGPU work is still renderer-owned derived state. It now includes
  uniform packing, required texture/sampler dependency keys, GPU material
  buffer creation, group-2 bind group planning/resource creation, render
  pipeline creation, and frame-resource assembly. Source `MatcapMaterial`
  assets still contain only stable texture/sampler handles.
- Matcap remains inactive in the app facade. There is still no render pass
  execution path, browser app example, or high-level app route for
  MatcapMaterial.
- The new browser example is diagnostic-only and asserts current limitations:
  mixed source mesh/material app frames are rejected, and unready material
  source dependencies are surfaced as JSON-safe diagnostics.

## Follow-Ups

- Activate a narrow single-material app-facade Matcap path before adding a
  browser example or promoting the material showcase.
- Add a broader render-world resource cache before promoting the material
  showcase onto built-in multi-material app rendering.
- Keep app examples on JSON-safe status helpers as app reports grow.
