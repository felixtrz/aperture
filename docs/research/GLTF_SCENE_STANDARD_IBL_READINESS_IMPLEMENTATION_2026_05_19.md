# GLTF Scene StandardMaterial IBL Readiness Implementation

Date: 2026-05-19

## Summary

Added a `StandardMaterialIblReadinessReport` in `packages/webgpu`.

The report consumes the renderer-owned IBL descriptor report and classifies
StandardMaterial IBL state as:

- `available` when diffuse and specular descriptor slots exist,
- `unsupported` when descriptors exist but slots are unsupported placeholders,
- `missing` when extracted environment maps have no descriptor, and
- `not-required` when no StandardMaterial or no environment map requires IBL.

The report keeps `sections.shaderSampling` false and emits a
`standardMaterialIbl.shaderSamplingDeferred` warning even when descriptors are
available. This prevents status from implying shader IBL sampling is active.

## Architecture Check

- ECS/source assets still contain only authoring intent and stable handles.
- Descriptor and StandardMaterial IBL readiness state is renderer-side,
  JSON-safe diagnostic data.
- No GPU handles, callbacks, source payloads, or renderer caches are serialized.
- No shader, bind group, or pipeline behavior changed in this slice.

## Next

Move to `task-1797`: define renderer-owned GLTF scene shadow-map descriptors
using the same readiness-first pattern before implementing shadow-map pass
submission.
