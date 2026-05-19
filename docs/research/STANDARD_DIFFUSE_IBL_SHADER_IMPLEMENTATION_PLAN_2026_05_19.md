# StandardMaterial Diffuse IBL Shader Implementation Plan

Date: 2026-05-19

## Scope

This plan prepares `task-1892`: add the first visible StandardMaterial diffuse
IBL shader contribution while preserving the strict shadow proof and the
browser `maxBindGroups: 4` constraint.

## Reference Patterns Inspected

- Aperture `standard-shader.ts`: StandardMaterial shader variant generation,
  texture feature declarations, shadow-map variant injection, and metadata.
- Aperture `standard-pipeline-descriptor.ts`: pipeline-token parsing,
  shader-variant selection, and bind-group layout cache-key selection.
- Aperture `standard-light-shadow-bind-group.ts`: combined browser-safe group 3
  layout/resource planning for light and shadow receiver resources.
- PlayCanvas-style WGSL chunks for environment processing and diffuse lighting.
- three.js PMREM references for the broader environment-map/precomputed lighting
  direction; the first Aperture slice should stay narrower than full PMREM.

## Constraints

- Executable browser forward draws must use groups 0 through 3 only.
- Group 4 remains a JSON-safe planning/cache/resource identity from `task-1890`.
- The first shader slice should use a simple diffuse irradiance contribution;
  specular prefilter and full PBR IBL remain deferred.
- Raw GPU handles must not appear in GLTF status or app render report JSON.

## Implementation Steps

1. Add an IBL-capable StandardMaterial pipeline token, likely `iblDiffuse`,
   derived from GLTF/app route readiness only when executable group 3 resources
   can be created.
2. Extend the combined group 3 layout descriptor for the IBL-capable variant
   with diffuse IBL texture-view and sampler bindings after the current
   light/shadow bindings.
3. Add a renderer-owned bridge that consumes the existing group 4 IBL resource
   report and creates the executable group 3 bind group resource for the chosen
   StandardMaterial pipeline variant.
4. Extend `standard-shader.ts` with diffuse IBL bindings in group 3 and add a
   small Lambert-style irradiance term:
   `diffuseIbl * baseColor * (1.0 - metallic)`.
5. Update GLTF status so `ibl.sampling.supported` becomes true only for the
   diffuse IBL slice, while specular/full PBR remains deferred.
6. Add Playwright before/after or controlled pixel proof that diffuse IBL changes
   visible StandardMaterial pixels while strict shadow receiver proof and WebGPU
   validation warnings stay clean.

## Non-Goals

- Do not add WGSL `@group(4)` to the default browser path.
- Do not implement specular prefilter contribution, skybox rendering, PMREM, or
  full environment BRDF integration in this slice.
- Do not move environment/IBL ownership into ECS or create renderer-owned game
  state.
