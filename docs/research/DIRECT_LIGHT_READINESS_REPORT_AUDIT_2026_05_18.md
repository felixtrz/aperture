# Direct Light Readiness Report Audit

Date: 2026-05-18

## Scope

Audit the `task-1206` direct-light readiness diagnostics report before any IBL,
shadow-map, clustered-lighting, or render-graph work.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/research/NEXT_LIGHTING_BOUNDARY_AFTER_STANDARD_MATERIAL_FIDELITY_PLAN_2026_05_18.md`
- `docs/research/NEXT_LIGHTING_BOUNDARY_PLAN_AUDIT_2026_05_18.md`
- `packages/webgpu/src/webgpu/direct-light-readiness.ts`
- `packages/webgpu/src/webgpu/light-packing.ts`
- `packages/webgpu/src/webgpu/light-shader-metadata.ts`
- `packages/webgpu/src/webgpu/standard-frame-resources.ts`
- `packages/webgpu/src/webgpu/app-diagnostics-summary.ts`
- `packages/webgpu/src/webgpu/app.ts`
- `test/webgpu/direct-light-readiness.test.ts`
- `test/webgpu/webgpu-app.test.ts`
- PlayCanvas `references/engine/src/scene/layer.js` split-light tracking
  pattern.
- three.js `references/three.js/src/renderers/shaders/UniformsLib.js` light
  family uniform grouping pattern.

## Findings

The implementation stays inside the intended diagnostics/readiness boundary.

- Light counts are derived from `RenderSnapshot.lights`, preserving ECS as the
  source of authored light state and avoiding renderer-owned scene objects.
- WebGPU readiness is represented as resource keys for light GPU buffers, the
  light bind group layout, and the light bind group. Raw `GPUBuffer`,
  `GPUBindGroup`, device, descriptor, and app objects are not exposed in the
  report JSON.
- Shader metadata readiness reuses the existing
  `createLightShaderResourceReadinessReport` contract instead of creating a
  second validation model.
- The WebGPU app diagnostics summary includes the direct-light section only
  when a StandardMaterial route is present, which keeps unlit/matcap-only
  status reports unchanged.
- The report adds no new ECS component, public scene object, IBL resource,
  shadow-map pass, clustered-lighting path, or StandardMaterial shading change.

## JSON Safety

Focused tests cover:

- populated ambient, directional, point, spot, and environment light counts;
- missing light-buffer, layout, bind-group, and shader-metadata readiness;
- JSON serialization without raw GPU handles or descriptor payloads;
- WebGPU app render-report JSON including the direct-light section for a
  StandardMaterial route with extracted lights.

## Architectural Notes

The report deliberately treats readiness as "the direct-light WebGPU binding
contract is present" rather than "the scene is artistically lit." Ambient-only
snapshots can therefore be resource-ready while still reporting `direct: 0`.
That is useful for diagnostics because later examples can distinguish "no
direct lights were extracted" from "the required buffers or bind groups are
missing."

The app-level resource adapter currently derives layout readiness from the
prepared StandardMaterial light bind group resource key rather than from a full
layout descriptor. That is sufficient for JSON-safe app status. Lower-level
metadata validation remains covered by `light-shader-metadata.ts`.

## Recommendation

`task-1206` is safe to keep. The next task should return to
`task-1203` and plan the follow-up StandardMaterial texture-transform coverage
before adding IBL, shadows, clustered lighting, or broader GLB viewer work.
