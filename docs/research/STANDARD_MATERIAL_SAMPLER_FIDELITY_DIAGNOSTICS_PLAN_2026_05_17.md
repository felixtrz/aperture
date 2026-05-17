# StandardMaterial Sampler Fidelity Diagnostics Plan

Date: 2026-05-17

Task: `task-1005`

## Context

Current Aperture coverage:

- `createSamplerAssetFromGltfSampler()` maps glTF sampler enum values into
  renderer-independent `SamplerAsset` fields and diagnoses invalid glTF enum
  values.
- `createStandardMaterialTextureReadinessReport()` verifies StandardMaterial
  texture bindings have ready texture and sampler handles.
- `createStandardMaterialTextureFidelitySummary()` counts missing/not-ready
  sampler issues from readiness diagnostics.
- WebGPU sampler creation consumes ready `SamplerAsset` values directly in
  `texture-resources.ts`.

The remaining sampler fidelity gap is not enum parsing or missing-resource
readiness. It is explaining when a ready sampler requests behavior that the
paired texture or current StandardMaterial path cannot faithfully satisfy.

## Reference Anchors Inspected

- Aperture:
  - `packages/render/src/materials/gltf-sampler.ts`
  - `packages/render/src/materials/standard-texture-readiness.ts`
  - `packages/render/src/materials/types.ts`
  - `packages/webgpu/src/webgpu/texture-resources.ts`
  - `packages/webgpu/src/webgpu/standard-material-texture-fidelity-summary.ts`
- PlayCanvas:
  - `references/engine/src/framework/parsers/glb-parser.js`
  - `references/engine/src/platform/graphics/texture.js`
  - `references/engine/src/scene/shader-lib/programs/standard.js`
- three.js:
  - `references/three.js/examples/jsm/loaders/GLTFLoader.js`
  - `references/three.js/src/textures/Texture.js`
  - `references/three.js/src/renderers/webgl/WebGLTextures.js`

Common pattern: glTF texture loading applies sampler wrap/filter defaults, and
renderer upload paths translate sampler/texture state into backend descriptors.
Both three.js and PlayCanvas track filter, wrap, mip, anisotropy, flip/color
space, and cache keys as texture/sampler-affecting state. Aperture should keep
the source assets renderer-independent while surfacing fidelity diagnostics
before WebGPU resource creation.

## Narrow Next Gap

Add a renderer-independent StandardMaterial sampler fidelity report that walks
ready StandardMaterial texture bindings and checks ready texture/sampler pairs.

Start with the highest-signal compatibility checks:

1. `mipmapFilter` requests mip sampling while `TextureAsset.mipLevelCount <= 1`.
2. `lodMaxClamp` exceeds the available texture mip range.
3. `maxAnisotropy > 1` is authored while the current prepared StandardMaterial
   diagnostics do not report anisotropic sampling support/readiness.

This should be warning-only. These cases can still render, but the rendered
result may not match author intent or glTF viewer expectations.

## Proposed API

Add to `packages/render/src/materials`:

- `createStandardMaterialSamplerFidelityReport({ registry, material })`
- `standardMaterialSamplerFidelityReportToJsonValue(report)`
- `standardMaterialSamplerFidelityReportToJson(report)`

Suggested report shape:

- `ready`: boolean, false only for source/material readiness errors.
- `materialKey`
- `materialStatus`
- `slots`: field, textureKey, samplerKey, mipLevelCount, min/mag/mipmap
  filters, lod clamps, max anisotropy, warning count.
- `diagnostics`: warning/error records with materialKey, textureKey,
  samplerKey, field, and JSON-safe numeric/source fields.

Diagnostic code candidates:

- `standardMaterialSampler.missingMaterial`
- `standardMaterialSampler.materialNotReady`
- `standardMaterialSampler.unsupportedMaterialKind`
- `standardMaterialSampler.textureNotReady`
- `standardMaterialSampler.samplerNotReady`
- `standardMaterialSampler.mipmapFilterWithoutMips`
- `standardMaterialSampler.lodMaxExceedsMipRange`
- `standardMaterialSampler.anisotropyNotReported`

## Non-Goals

- Do not change texture upload or mip generation.
- Do not add IBL, shadows, or broader PBR work.
- Do not mutate sampler assets, texture assets, materials, or WebGPU resources.
- Do not make this an app report by default.
- Do not replace existing texture readiness or texture fidelity summaries.

## Implementation Follow-Up

Add a new ready task after the current queue:

```md
### task-1007 — Add StandardMaterial sampler fidelity report

Category: `render-bridge`
Package/write-scope: `packages/render/src/materials`, targeted tests, and
diagnostics docs/tracker files if public summary status changes.
Reference anchor:
Plan from `task-1005`, `packages/render/src/materials/standard-texture-readiness.ts`,
`packages/render/src/materials/gltf-sampler.ts`, and three.js/PlayCanvas sampler
translation paths.

Acceptance criteria:

- Report warns when a ready sampler requests mip filtering for a texture with no
  extra mip levels.
- Report warns when sampler LOD max exceeds the texture mip range.
- Report warns when anisotropy is authored but not reflected in current
  StandardMaterial diagnostics/readiness.
- JSON output is handle-safe and does not include texture source payloads,
  sampler objects, or GPU handles.
- Targeted tests pass.
```
