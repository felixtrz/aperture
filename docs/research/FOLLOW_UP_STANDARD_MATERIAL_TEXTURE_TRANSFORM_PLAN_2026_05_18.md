# Follow-Up StandardMaterial Texture Transform Plan

Date: 2026-05-18

## Scope

Select the next narrow StandardMaterial texture-transform slice after the
metallic-roughness transform implementation and direct-light readiness
diagnostics audit.

This is a planning task only. It does not implement shader, buffer, glTF
mapping, or browser fixture changes.

## References Inspected

- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/STANDARD_MATERIAL_METALLIC_ROUGHNESS_TRANSFORM_SUPPORT_AUDIT_2026_05_18.md`
- `docs/research/NEXT_STANDARD_MATERIAL_PBR_FIDELITY_SLICE_PLAN_2026_05_18.md`
- `docs/research/DIRECT_LIGHT_READINESS_REPORT_AUDIT_2026_05_18.md`
- `packages/render/src/materials/standard-texture-readiness.ts`
- `packages/webgpu/src/webgpu/standard-material-buffer.ts`
- `packages/webgpu/src/webgpu/standard-shader.ts`
- `examples/standard-gltf-texture.js`
- `test/materials/standard-texture-readiness.test.ts`
- `test/e2e/standard-gltf-texture.spec.ts`

## Current State

Supported finite `KHR_texture_transform` cases:

- `baseColorTexture` on `TEXCOORD_0`, including offset, scale, and rotation.
- `metallicRoughnessTexture` on `TEXCOORD_0`, including offset, scale, and
  rotation.

Still unsupported and correctly diagnosed:

- transformed `TEXCOORD_1`;
- transformed `normalTexture`;
- transformed `occlusionTexture`;
- transformed `emissiveTexture`;
- broad all-slot transform support.

## Selected Next Slice

Implement `normalTexture` transform support for the same proven finite
`TEXCOORD_0` case:

- texture slot: `normalTexture`;
- texcoord set: `TEXCOORD_0`;
- transform fields: finite offset, scale, and rotation;
- keep transformed `TEXCOORD_1`, occlusion, emissive, and any unsupported or
  non-finite transform cases diagnostic-only.

## Why Normal Texture Next

Normal maps are part of the core glTF metallic-roughness path and are already
present in browser fixture coverage. Supporting their texture transform is a
useful PBR fidelity step before environment lighting or shadows because it
improves material interpretation without adding a new pass or resource family.

This slice should remain narrow:

- reuse the existing transform helper and packing pattern from base-color and
  metallic-roughness;
- add only the extra normal texture transform fields needed by the shader;
- keep tangent requirements and existing normal-map diagnostics unchanged;
- do not change the BRDF, IBL, shadow, or binary GLB loading path.

## Implementation Notes For `task-1204`

Likely write scope:

- `packages/render/src/materials/gltf-material.ts`
- `packages/render/src/materials/standard-texture-readiness.ts`
- `packages/webgpu/src/webgpu/standard-material-buffer.ts`
- `packages/webgpu/src/webgpu/standard-shader.ts`
- `examples/standard-gltf-texture.js`
- focused unit tests and one browser scenario if the shader path changes pixels
  deterministically.

Expected validation:

- glTF mapping accepts a finite `normalTexture` transform on `TEXCOORD_0`.
- StandardMaterial texture readiness accepts that same case.
- Unsupported diagnostics remain for transformed normal `TEXCOORD_1` and for
  transformed occlusion/emissive slots.
- Uniform packing remains 16-byte aligned after any new fields.
- WGSL applies the normal texture transform before sampling the normal map.
- Browser coverage verifies the transformed normal texture scenario reaches the
  rendered path without unsupported transform diagnostics.

## Deferred

Do not include in the next implementation:

- occlusion or emissive transform support;
- transformed `TEXCOORD_1`;
- all-slot transform support;
- IBL or shadows;
- binary GLB scene loading;
- material queue architecture refactors.

## Recommendation

Proceed with `task-1204` as `normalTexture` transform support on `TEXCOORD_0`,
then audit it with `task-1205` before selecting another material-fidelity or
lighting slice.
