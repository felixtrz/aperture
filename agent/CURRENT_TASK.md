# Current Task

No active task is currently checked out.

Status: SOTA roadmap M1-T6 texture mip generation and KTX2 mip-chain upload
completed in commit `d1967a2a`.

Key findings:

- `createTextureGpuResource()` now uploads explicit mip levels and can generate
  uncompressed GPU mip chains through a renderer-owned WGSL downsample pass.
- KTX2/Basis decode/transcode paths now expose all texture levels, and app
  texture upload preserves those precomputed levels.
- `examples/compressed-gltf.html?asset=ktx2` reports a six-level compressed
  mip chain with no WebGPU upload warnings after a dist rebuild.
- The standard glTF sampler route reports a real mip chain and no
  `standardMaterialSampler.mipmapFilterWithoutMips` diagnostic.

Recommended next task:

- `M1-T7` — implement `CameraHandle.rayFromPointer` with real camera
  unprojection.
