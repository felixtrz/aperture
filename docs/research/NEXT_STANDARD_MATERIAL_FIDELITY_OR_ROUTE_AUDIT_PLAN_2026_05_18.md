# Next StandardMaterial Fidelity Or Route Audit Plan

Date: 2026-05-18

## Scope

Select the next task after audited `normalTexture` transform support.

This plan compares one more small StandardMaterial texture-fidelity slice
against pausing for route/prepared-resource audit work. It intentionally avoids
IBL, shadows, render targets, binary GLB viewer work, and all-slot transform
support.

## References Inspected

- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/ARCHITECTURE.md`
- `docs/research/STANDARD_MATERIAL_NORMAL_TRANSFORM_SUPPORT_AUDIT_2026_05_18.md`
- `docs/research/DIRECT_LIGHT_READINESS_REPORT_AUDIT_2026_05_18.md`
- `packages/render/src/materials/standard-texture-readiness.ts`
- `packages/webgpu/src/webgpu/standard-material-buffer.ts`
- `packages/webgpu/src/webgpu/standard-shader.ts`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`

## Current State

Supported finite `KHR_texture_transform` cases:

- `baseColorTexture` on `TEXCOORD_0`.
- `metallicRoughnessTexture` on `TEXCOORD_0`.
- `normalTexture` on `TEXCOORD_0`.

Still unsupported and diagnosed:

- transformed `TEXCOORD_1`;
- transformed `occlusionTexture`;
- transformed `emissiveTexture`;
- all-slot transform support.

The route/prepared-resource path is carrying the texture variants, but the
recent changes still fit the existing StandardMaterial family route. There is
not yet evidence that a route audit must interrupt one more narrow
texture-fidelity slice.

## Selected Next Slice

Proceed with `occlusionTexture` transform support for finite transforms on
`TEXCOORD_0`.

Rationale:

- Occlusion is part of the glTF metallic-roughness material model.
- The shader already samples occlusion and applies it to ambient diffuse.
- Adding the transform should reuse the same helper and uniform-block pattern
  as base-color, metallic-roughness, and normal transforms.
- The slice should not require a new material family, render pass, prepared
  resource kind, or route shape.

## Implementation Scope For `task-1209`

Implement only:

- glTF mapping acceptance for finite `occlusionTexture` transforms on
  `TEXCOORD_0`;
- StandardMaterial readiness acceptance for the same case;
- one aligned occlusion texture transform block in the StandardMaterial uniform
  layout;
- WGSL transform application before occlusion texture sampling;
- focused unit tests and a browser fixture scenario proving the transformed
  occlusion path renders without unsupported-transform diagnostics.

## Deferred

Keep these diagnostic-only:

- transformed `TEXCOORD_1`;
- transformed `emissiveTexture`;
- non-finite transforms;
- all-slot transform support.

Do not add:

- IBL or environment lighting;
- shadow maps;
- binary GLB scene loading;
- material route architecture changes.

## Follow-Up

After `task-1209`, run `task-1210` to audit whether one more emissive transform
slice is safe or whether the route/prepared-resource audit should happen first.
