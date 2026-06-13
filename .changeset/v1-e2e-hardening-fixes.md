---
"@aperture-engine/render": patch
"@aperture-engine/webgpu": patch
---

Release-readiness fixes from the e2e hardening pass:

- `createGltfSourceAssetTransferPackage` no longer transfers buffers it does
  not own. Source views can alias loader-cache memory (the per-URI byte cache
  in `loadGlbFromUri`/`loadGltfFromUri`); transferring those buffers detached
  the cache and the next load sharing a URI failed with "An ArrayBuffer is
  detached and could not be cloned". The package now always slices, keeping
  the post zero-copy across the thread boundary while leaving caller caches
  intact.
- `pick` reports a structured `webGpuApp.pickDeviceUnavailable` diagnostic
  when the GPU device dies mid-pick instead of throwing an unhandled
  `OperationError` past the report boundary.
- The app render-pipeline cache key now includes the mesh vertex layout. Two
  meshes sharing a material variant but with different vertex stream layouts
  (e.g. an interleaved primitive floor and a multi-stream glTF mesh in the
  same scene) previously collided on one cached pipeline; the second draw
  then failed Dawn validation with "Vertex buffer slot N required … was not
  set", producing an invalid command buffer and a blank frame. Pipelines are
  now keyed per layout.
