# Next Lighting Boundary After StandardMaterial Fidelity Plan

Date: 2026-05-18

## Scope

Plan the next lighting boundary after the StandardMaterial
metallic-roughness texture-transform slice.

This plan intentionally avoids implementing IBL, shadows, render targets, a
binary GLB viewer, or clustered lighting. It selects the smallest lighting work
that can improve confidence without outrunning the current material and route
architecture.

## References Inspected

- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/ARCHITECTURE.md`
- `docs/research/LIGHTING_ENVIRONMENT_SHADOW_COVERAGE.md`
- `docs/research/STANDARD_MATERIAL_METALLIC_ROUGHNESS_TRANSFORM_SUPPORT_AUDIT_2026_05_18.md`
- `packages/webgpu/src/webgpu/light-packing.ts`
- `packages/webgpu/src/webgpu/light-shader-metadata.ts`

## Current State

Lighting already has useful foundations:

- ECS-owned light authoring is extracted into flat `LightPacket` data.
- WebGPU light buffer packing and bind-group metadata exist.
- StandardMaterial uses direct scene lighting in the current proof paths.
- Shadow request schemas and diagnostics are documented for future use.

Lighting is not ready for broad rendering expansion yet:

- IBL/environment lighting would require environment-map asset contracts,
  filtered radiance/irradiance resources, shader bindings, diagnostics, and
  browser verification.
- Shadow rendering would require one or more extra render passes, shadow-map
  resources, camera/frustum planning, caster queues, receiver sampling, and
  pass diagnostics.
- Both would touch pipeline behavior more deeply than the latest
  StandardMaterial texture-fidelity slice.

## Selected Next Boundary

Do not implement IBL or shadows next.

The next lighting implementation should be a diagnostics/readiness boundary for
the existing direct-light path:

- Add or tighten a JSON-safe StandardMaterial lighting readiness report for
  WebGPU app status.
- Summarize light packet counts by kind and whether required WebGPU light
  resources are present.
- Surface whether the direct-light shader path has the light bind group and
  metadata it expects.
- Keep the report derived from render snapshots and WebGPU resources, not from
  mutable renderer-owned light objects.
- Add focused tests for no-light, ambient-only, directional, and invalid/missing
  resource cases.

## Why This Boundary

This advances the lighting track without adding a new pass or asset type.

It also gives later IBL and shadow work a safer checkpoint:

- IBL can reuse the same report shape to add environment-resource readiness.
- Shadows can later add shadow-pass readiness and shadow request summaries.
- Browser examples can explain missing or unbound lighting resources without
  relying on raw GPU objects.

## Acceptance Criteria For Implementation

- A report helper returns JSON-safe direct-light readiness data.
- The report includes light counts by kind and the readiness of light buffers,
  light bind group layout, light bind group, and shader metadata.
- The helper does not import ECS/simulation or mutate WebGPU resources.
- Tests cover populated and missing-resource cases.
- No IBL, shadow-map pass, clustered-lighting path, or new public scene object
  is introduced.

## Follow-Up Recommendation

After implementation, audit the report against the ECS/render/WebGPU boundary.
Only then decide whether to plan environment lighting contracts or continue
with one more StandardMaterial material-fidelity slice.
