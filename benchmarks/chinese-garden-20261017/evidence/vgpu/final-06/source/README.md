# vGPU Chinese garden

A procedural 3D garden authored with vGPU 0.6.0. Uses its native `geometry`, `draw`, `frame`, `target`, `effect`, `surface`, camera and matrix APIs. No Three.js renderer/bridge, imported scene assets, textures, reference-image projection, or image generation.

The deterministic scene includes a stone plinth, curved timber pavilion, jade pond, arched stone bridge, circular moon gate, plaster walls and tiled caps, twisted pines, jointed bamboo, pierced scholar rocks, shrubs, grasses, stepping stones, lotus pads, and flowers. Custom WGSL implements warm diffuse/hemisphere lighting, PCF sun shadows, planar water reflections, fine surface grain and contact occlusion from a resolved normal/depth MRT. Canvas is 1200×900 with 4x MSAA and no UI.

From `/workspace/aperture`, reproduce via the approved harness in a fresh trial with capture budget available:

```sh
node benchmarks/chinese-garden-20261017/shared/capture.mjs vgpu final-06
```

The existing `final-06` evidence label is immutable. For a fresh reproduction use an unused label and a fresh capture budget managed by the coordinator. Browser launches must stay within that shared harness. A standalone build can be run with the repository Vite CLI against this directory and `vite.config.mjs`.

`__APERTURE_RENDER_STATUS__` is set only after scene construction, frame submission, vGPU settlement and `GPUQueue.onSubmittedWorkDone()`. All meshes and shaders are in the local source files. See `journal.md` for iterations and framework friction.
