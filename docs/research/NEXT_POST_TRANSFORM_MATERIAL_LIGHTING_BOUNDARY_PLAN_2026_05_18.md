# Next Post-Transform Material Lighting Boundary Plan

Date: 2026-05-18

## Scope

Choose the next concrete implementation or audit boundary after occlusion
texture transform support and the generic route/prepared-resource pressure
audit.

## References Inspected

- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/ARCHITECTURE.md`
- `docs/research/STANDARD_MATERIAL_OCCLUSION_TRANSFORM_SUPPORT_AUDIT_2026_05_18.md`
- `docs/research/GENERIC_ROUTE_PREPARED_RESOURCE_PRESSURE_AUDIT_2026_05_18.md`
- `docs/research/DIRECT_LIGHT_READINESS_REPORT_AUDIT_2026_05_18.md`

## Current State

StandardMaterial now supports finite `KHR_texture_transform` on `TEXCOORD_0`
for:

- `baseColorTexture`;
- `metallicRoughnessTexture`;
- `normalTexture`;
- `occlusionTexture`.

Still deferred:

- `emissiveTexture` transform support;
- transformed `TEXCOORD_1`;
- all-slot transform support;
- IBL/environment lighting;
- shadows;
- binary GLB viewer integration.

The route/prepared-resource audit found no immediate blocker to one final
small texture-fidelity slice, but recommends pausing for route or lifetime
cleanup after that.

## Selected Next Boundary

Add `emissiveTexture` finite transform support on `TEXCOORD_0`.

Why:

- It completes the currently rendered StandardMaterial glTF texture slots for
  the supported UV0 transform case.
- It reuses the same uniform and WGSL transform helper pattern.
- It does not require IBL, shadows, a new material family, or a new route.
- It gives a clean point to pause afterward and audit/clean up route pressure.

## Acceptance Criteria For The Next Implementation

- glTF mapping accepts finite `emissiveTexture` transforms on `TEXCOORD_0`.
- StandardMaterial texture readiness accepts the same case.
- StandardMaterial uniform packing adds an aligned emissive transform block.
- WGSL applies the transform before emissive texture sampling.
- Browser coverage verifies `emissive-transform` renders without unsupported
  transform diagnostics.
- Transformed `TEXCOORD_1`, non-finite transforms, IBL, shadows, and binary GLB
  loading remain deferred.

## Follow-Up

After the emissive transform implementation and audit, select a route cleanup,
prepared-resource lifetime/cache, or generic material-family route task before
IBL, shadows, or binary GLB viewer work.
