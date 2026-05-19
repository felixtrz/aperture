# Diffuse IBL Route Ownership Audit

Date: 2026-05-19

## Scope

Audit the first executable StandardMaterial diffuse IBL slice after
`task-1892`.

## Reference Anchors

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/research/STANDARD_DIFFUSE_IBL_SHADER_IMPLEMENTATION_PLAN_2026_05_19.md`
- Bevy render patterns: extracted render app state, prepared assets, queued
  phase items, and material bind-group preparation remain conceptual anchors.

## Findings

- ECS remains authoritative. The new `iblDiffuse` pipeline key is derived from
  extracted StandardMaterial draws plus renderer-owned readiness reports; no ECS
  component stores WebGPU handles or prepared IBL resources.
- GPU resources remain renderer-owned. Diffuse IBL texture views, samplers,
  light buffers, shadow receiver resources, and executable combined group 3 bind
  groups are created inside `@aperture-engine/webgpu`.
- Group 4 remains a JSON-safe planning/resource identity. The app keeps
  `standardMaterialIblBindGroup` as an inspectable group 4 resource, while
  executable draw bind groups stay within groups 0 through 3.
- Browser `maxBindGroups: 4` compatibility is preserved. The GLTF scene now
  routes StandardMaterial draws through
  `standard|iblDiffuse|shadowMap|opaque|back|less|none` and Playwright verifies
  no group 4 draw binding.
- The visible proof is now complete for this slice. Playwright compares the
  scene with `disable-ibl-sampling=1` against the normal app path and asserts a
  stable StandardMaterial pixel delta while preserving the strict receiver
  shadow proof.

## Recommended Next Slice

Add a narrow specular IBL planning audit before implementing specular sampling.
The next implementation should not jump directly to full PBR IBL. It should
first define the source/prepared-resource and shader-readiness contract for the
existing specular IBL texture resource, including whether the current placeholder
resource is sufficient for a visible proof or whether a minimal prefilter/upload
step is required.
