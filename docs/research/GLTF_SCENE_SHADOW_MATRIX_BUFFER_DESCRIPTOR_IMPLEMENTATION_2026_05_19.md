# GLTF Scene Shadow Matrix Buffer Descriptor Implementation

Date: 2026-05-19

## Summary

Added `ShadowMatrixBufferDescriptorReport` in `packages/webgpu` and exposed it
through the GLTF scene status under `shadow.matrixBuffer`.

The report consumes `DirectionalShadowViewProjectionPlanReport` and derives a
JSON-safe descriptor for a directional shadow matrix storage buffer:

- stable buffer resource key,
- label and usage intent,
- matrix count,
- 64-byte matrix stride,
- total byte size,
- one entry per planned shadow view/projection matrix, and
- deferred upload diagnostics.

No GPU buffer is allocated and no matrix data is uploaded. The descriptor is a
resource contract for a later WebGPU allocation/upload step.

## Reference Pattern

- PlayCanvas computes a shadow view-projection matrix and copies directional
  shadow matrices into a palette before rendering shadow passes.
- Three.js updates each `LightShadow` matrix from the light camera before
  shadow-map rendering and later samples that matrix in shader chunks.

Aperture's version keeps the same staged concept, but represents the matrix
buffer as ECS-derived, renderer-owned, WebGPU-only metadata until the live
resource allocation path exists.

## Validation

- `pnpm exec vitest run test/webgpu/shadow-matrix-buffer-descriptor.test.ts test/webgpu/directional-shadow-view-projection-plan.test.ts`
- `pnpm run typecheck:test`
- `pnpm run check:examples`

## Next Step

`task-1812` should bridge the IBL descriptor, texture preparation, and pass-plan
reports into a compact IBL resource summary before moving to live IBL texture
allocation or shader sampling.
