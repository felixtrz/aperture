# First Live Shadow Resource Allocation Plan — 2026-05-19

## Task

`task-1828` compared first live WebGPU shadow resource allocation candidates.

## Candidates

### Shadow Texture Allocation

Pros:

- Directly follows `shadow-texture-resource`.
- Mirrors the diffuse IBL texture allocation path.
- Proves renderer-owned depth texture/view allocation before command encoding.

Cons:

- Does not by itself produce visible shadows.
- Needs clear status language so users do not infer shadow sampling is active.

### Shadow Matrix Buffer Allocation / Upload

Pros:

- Moves directional view/projection planning toward shader-readable data.
- Small buffer allocation and upload path.

Cons:

- Matrix computation is still deferred; uploading placeholder matrices would be
  misleading unless the computation step lands first.

### Shadow Command Encoding

Pros:

- Closest to an actual shadow pass.

Cons:

- Requires shadow texture allocation, matrix data, depth material/pipeline
  selection, render-pass setup, and command submission policy.
- Too broad as the first live shadow-resource slice.

## Selection

Implement shadow texture allocation first.

The task should allocate a renderer-owned depth texture/view resource from
existing `ShadowTextureResourceReport` descriptors with an injected WebGPU-like
device. It should remain data/resource focused: no shadow matrix computation,
no shadow pass command encoding, no StandardMaterial shadow sampling.

## Recommended Follow-Up Task

```md
### task-1832 — Allocate shadow depth texture resource

Category: `webgpu-render`
Package/write-scope: `packages/webgpu`, targeted tests, and GLTF scene status.
Reference anchor: local `shadow-texture-resource`, local `texture-resources`,
`references/engine/src/scene/renderer/render-pass-shadow-directional.js`, and
`references/three.js/src/renderers/webgl/WebGLShadowMap.js`.

Acceptance criteria:

- Create renderer-owned shadow depth texture/view resources from planned shadow
  texture descriptors using an injected WebGPU-like device.
- Report stable texture/view resource keys and diagnostics without raw GPU
  handles in JSON helpers.
- GLTF scene status distinguishes allocated shadow texture resources from
  deferred matrix computation, command encoding, and shader sampling.
```

## Deferred

- Directional shadow matrix computation.
- Shadow matrix buffer allocation/upload.
- Shadow pass command encoding/submission.
- StandardMaterial shadow sampling.
