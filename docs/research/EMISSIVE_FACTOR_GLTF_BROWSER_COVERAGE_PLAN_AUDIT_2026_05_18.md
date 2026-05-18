# Emissive-Factor glTF Browser Coverage Plan Audit

Date: 2026-05-18

Task: `task-1591`

## Scope

Audit the `task-1590` plan to add a glTF-shaped StandardMaterial browser
scenario for `emissiveFactor` without `emissiveTexture`.

## Findings

- The selected follow-up is concrete enough for one focused run.
- The existing glTF browser fixture already has emissive texture scenarios, so
  a factor-only scenario can reuse the same app setup while omitting texture and
  sampler assets.
- Reference engines treat emissive color/factor as a material input that can
  contribute without an emissive texture. Aperture's StandardMaterial data model
  already carries `emissiveFactor`.
- The acceptance criteria explicitly require no texture/sampler registration or
  GPU resource creation, which prevents accidental broadening into texture
  matrices.

## Boundary Check

- ECS authority is preserved: authoring remains source material data referenced
  through existing ECS/render extraction.
- WebGPU backend ownership is preserved: any rendered output still comes from
  prepared renderer-owned resources, and the scenario should not serialize raw
  GPU handles.
- The task does not require route traversal changes, prepared-resource lifetime
  changes, binary GLB loading, IBL, shadows, or app-level non-built-in material
  rendering.

## Recommendation

Proceed to `task-1592`.

Implementation should stay within:

- `examples/standard-gltf-texture.js`;
- `test/e2e/standard-gltf-texture.spec.ts`;
- no implementation files unless the fixture exposes a focused defect.
