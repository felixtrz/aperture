# Specular IBL Shader Readiness Plan

Date: 2026-05-19

## Scope

Plan the first narrow StandardMaterial specular IBL shader slice after the
placeholder specular proof-upload contract.

## Reference Anchors

- `docs/research/SPECULAR_IBL_CONTRACT_AUDIT_2026_05_19.md`
- `packages/webgpu/src/webgpu/standard-shader.ts`
- `packages/webgpu/src/webgpu/standard-pipeline-descriptor.ts`
- `packages/webgpu/src/webgpu/standard-light-shadow-bind-group.ts`
- PlayCanvas reflection/environment chunks, especially cube/atlas reflection
  sampling and roughness-level selection.
- three.js PMREM generator, especially GGX VNDF prefiltering and
  roughness-dependent environment radiance.

## Selected Slice

Implement a placeholder specular IBL shader contribution behind a new
`iblSpecularProof` token.

This is intentionally not full PMREM/GGX IBL. The shader should sample the
renderer-owned specular cube texture and add a small Fresnel-weighted reflection
term using the existing roughness factor only as a dampening scalar. Diagnostics
must continue to say full PMREM/GGX prefiltering and split-sum BRDF are
deferred.

## Required Contract

- Pipeline key: `iblSpecularProof`, enabled only when diffuse IBL sampling is
  already ready and the specular proof-upload placeholder diagnostic is present.
- Group 3 bindings:
  - binding 5: diffuse IBL cube texture.
  - binding 6: IBL sampler.
  - binding 7: specular proof cube texture.
- Group 4 remains the JSON-safe planning identity for diffuse/specular/sampler
  resources. It is not bound by executable draw commands.
- WGSL contribution:
  - Reflect `-viewDir` around the world normal.
  - Sample `standardSpecularIblTexture` with the existing IBL sampler.
  - Weight by Schlick Fresnel and `(1.0 - roughness * 0.5)` so the proof is
    visible but clearly narrower than full PBR IBL.
- GLTF/Playwright proof:
  - Add a `disable-specular-ibl-sampling=1` flag or equivalent controlled
    status path.
  - Compare a StandardMaterial region with and without specular proof sampling.
  - Keep strict receiver shadow proof and no group 4 executable binding.

## Follow-Up Task

Implement `iblSpecularProof` as a narrow shader/readiness slice, with targeted
shader/pipeline/app tests and one GLTF Playwright pixel-delta proof. Do not
remove the full prefiltering deferred diagnostics.
