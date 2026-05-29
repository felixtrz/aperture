# Current Task

No active task is currently checked out.

Status: SOTA roadmap M1-T5 compressed glTF app decoder wiring completed in
commit `79bc53e6`.

Key findings:

- App/system glTF loading now accepts a `SystemGltfAssetDecoderProvider` and
  threads lazy Draco, Meshopt, and Basis/KTX2 decoder factories into render URI
  loaders.
- Generated WebGPU app workers receive decoder base URLs from config and
  device-derived KTX2 texture-compression support from `createWebGpuApp()`.
- `examples/compressed-gltf.html` proves engine-supplied Draco decoding and a
  KTX2/Basis route without route-level decoder registration.
- Generated worker asset summaries expose texture format/source-data metadata so
  browser routes can distinguish compressed GPU targets from rgba32 fallback.

Recommended next task:

- `M1-T6` — generate GPU mipmaps for material textures and upload KTX2
  precomputed mip chains.
