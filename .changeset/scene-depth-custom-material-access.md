---
"@aperture-engine/render": minor
"@aperture-engine/webgpu": minor
"@aperture-engine/app": minor
---

Depth access for custom WGSL materials (parity plan B4) — the analog of
three.js `depthTexture` / `sceneDepthNode` depth-fade materials. A custom-WGSL
texture binding gains a renderer-owned `source: "scene-depth"` (data-only, no
handle) that binds the frame's stored scene depth read-only, and the
binding-layout variants that close the pre-B4 float/2D/filtering hard-coding:
texture `sampleType` (`float | unfilterable-float | depth | sint | uint`),
`viewDimension` (`2d | cube`), `multisampled`, and sampler `samplerType`
(`filtering | non-filtering | comparison`, backed by a new `SamplerAsset.compare`
comparison sampler). Each variant enters the bind-group layout AND the pipeline
key only when set to a non-default value, so existing materials keep
byte-identical keys. A scene-depth binding requires a transparent material
(`alphaMode: "blend"`) — validated at preparation
(`customMaterialSource.sceneDepthRequiresTransparent`), never as a device error —
which places the draw in the post-opaque phase; the renderer then routes it
through a submission that attaches the scene depth READ-ONLY so it can sample the
depth the opaque pass wrote (and still depth-test against it). The MSAA path
samples the depth as a multisampled attachment (`texture_depth_multisampled_2d`)
through the same read-only-depth submission. Also fixes a latent bug where the
depth-attachment planner emitted `depthLoadOp`/`depthStoreOp` alongside
`depthReadOnly: true`, which WebGPU forbids and silently failed every
read-only-depth pass. The app facade `material.texture(...)` creator accepts
`source` / `sampleType` / `viewDimension` / `multisampled`, and
`material.sampler(...)` accepts `samplerType`. Ships `examples/forcefield`
(an opaque wall + a transparent slab whose custom material glows where it
intersects the wall, single-sample and MSAA variants) with pixel-assertion e2e
coverage. User render passes already read the built-in `"depth"` resource
(unchanged; covered by `custom-graph-pass`).
