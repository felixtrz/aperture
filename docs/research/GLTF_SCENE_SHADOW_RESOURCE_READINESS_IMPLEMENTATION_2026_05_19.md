# GLTF Scene Shadow Resource Readiness Implementation

Date: 2026-05-19

## Summary

Added `ShadowResourceReadinessReport` in `packages/webgpu`.

The report consumes `ShadowMapDescriptorReport` and surfaces:

- descriptor-backed shadow resource keys,
- descriptor and request counts,
- JSON-safe section readiness, and
- a `shadowResourceReadiness.passSubmissionDeferred` warning that keeps shadow
  texture allocation and pass submission explicitly inactive.

The GLTF scene app now reports shadow request status, shadow-map descriptors,
and shadow resource/pass readiness together. This gives the next agent a clear
diagnostic boundary before adding an actual shadow pass.

## Deferred

- WebGPU shadow texture allocation.
- Shadow render pass submission.
- Shadow matrix packing.
- StandardMaterial shadow sampling.
- Visible shadow pixels.
