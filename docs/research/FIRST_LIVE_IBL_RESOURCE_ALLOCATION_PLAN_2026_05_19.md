# First Live IBL Resource Allocation Plan — 2026-05-19

## Task

`task-1825` compared first live WebGPU IBL resource allocation candidates after
the descriptor/readiness/status chain landed.

## Candidates

### Diffuse Irradiance Texture Allocation

Pros:

- Smallest visible step toward IBL resource ownership.
- Uses one planned texture/view slot from `ibl-texture-preparation`.
- Can be validated with a fake WebGPU device before real prefiltering.

Cons:

- Does not by itself prove specular prefilter or material sampling.
- Needs clear diagnostics to avoid implying lighting is active.

### Specular Prefilter Texture Allocation

Pros:

- Closer to the eventual StandardMaterial roughness path.
- Aligns with three.js PMREM and PlayCanvas environment atlas concepts.

Cons:

- More complicated than diffuse because meaningful prefiltering needs mip/rough
  level planning.
- Easy to overbuild before the simple upload/resource contract is proven.

### IBL Sampler Allocation

Pros:

- Very small WebGPU-owned resource slice.
- Directly follows `ibl-sampler-descriptor-readiness`.

Cons:

- Less valuable alone because samplers without texture views do not advance the
  scene toward visible IBL.

## Selection

Implement diffuse IBL texture resource allocation first.

The task should allocate a renderer-owned texture/view resource from the
existing diffuse IBL texture descriptor slot through an injected WebGPU-like
device. It should remain data/resource focused: no PMREM prefilter pass, no
bind-group layout change, and no StandardMaterial shader sampling.

## Recommended Follow-Up Task

```md
### task-1827 — Allocate diffuse IBL texture resource

Category: `webgpu-render`
Package/write-scope: `packages/webgpu`, targeted tests, and GLTF scene status.
Reference anchor: `references/engine/src/scene/graphics/env-lighting.js`,
`references/three.js/src/extras/PMREMGenerator.js`, local
`ibl-texture-preparation`, and local `texture-resources`.

Acceptance criteria:

- Create a renderer-owned diffuse IBL texture/view resource from a planned IBL
  texture slot using an injected WebGPU-like device.
- Report stable resource keys and creation diagnostics without raw GPU handles
  in JSON helpers.
- GLTF scene status distinguishes allocated diffuse IBL texture resources from
  deferred specular prefiltering and deferred shader sampling.
```

## Deferred

- Specular PMREM/prefilter pass generation.
- IBL bind-group layout changes.
- StandardMaterial shader sampling.
- Public custom material APIs.
