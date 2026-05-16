# Matcap App Activation Boundary Audit — 2026-05-16

## Scope

Audited the material-family activation work that moved `MatcapMaterial` from
WebGPU helper coverage into the narrow single-source-resource
`createWebGpuApp.render()` path and added a browser app-facade example.

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- Bevy material and render asset patterns:
  - `references/bevy/crates/bevy_pbr/src/material.rs`
  - `references/bevy/crates/bevy_render/src/render_asset.rs`
- Local app/material paths:
  - `packages/webgpu/src/webgpu/app.ts`
  - `packages/webgpu/src/webgpu/matcap-frame-resources.ts`
  - `packages/webgpu/src/webgpu/matcap-bind-group.ts`
  - `packages/webgpu/src/webgpu/matcap-pipeline.ts`
  - `examples/matcap-app.js`

## Checks

- `simulation` and `render` package source searches found no WebGPU/browser
  state imports or DOM/global browser usage introduced by this activation work.
- Package dependency direction remains aligned:
  - `simulation` depends only on ECS/math foundations.
  - `render` depends on `simulation`.
  - `webgpu` depends on `render` and `simulation`.
- `MatcapMaterial` remains renderer-independent source asset data in `render`.
- Matcap texture and sampler dependencies are still source asset handles until
  the WebGPU app facade prepares renderer-owned texture/sampler resources.
- The app facade keeps the existing single mesh/material resource-set limit and
  continues to diagnose mixed resource sets with
  `webGpuApp.additionalDrawResourceUnsupported`.
- Browser status for the new Matcap app route publishes
  `webGpuAppRenderReportToJsonValue()` output and omits raw WebGPU handles.
- The new Playwright route verifies rendered pixels, animation, resource reuse,
  and JSON-safe app report output.
- Follow-up texture upload work added renderer-independent `TextureAsset`
  source texel data and maps it to WebGPU-owned texture uploads only inside the
  app facade.

## Result

No ECS/render ownership drift was found. The Matcap path follows the same
derived-rendering boundary as the existing unlit and StandardMaterial app
paths: ECS owns authored handles and transforms, extraction emits snapshots, and
`packages/webgpu` owns pipeline, buffer, texture, sampler, and bind group
resources.

## Follow-Up Resolved In Same Run

The initial audit found that the Matcap browser example proved the app-facade
material path and non-background pixels, but source `TextureAsset` did not yet
carry uploadable texel data. `task-0595` resolved that gap by adding optional
source texel data to renderer-independent texture assets and using
`GPUQueue.writeTexture` only from the WebGPU app facade.
