# IBL Material Fidelity Diagnostics Audit

Date: 2026-05-19

## Scope

Audit diffuse IBL plus placeholder specular IBL after the first browser-visible
specular proof.

## Findings

- Diagnostics still avoid overstating full PBR readiness. GLTF status reports
  `specularProof: true` but continues listing `specular-prefilter`,
  `split-sum-brdf`, and `skybox` as deferred.
- Specular resources distinguish proof upload from full prefiltering:
  `iblTextureResource.specularProofUploadPlaceholder` is separate from
  `iblTextureResource.specularPrefilteringDeferred`.
- Group 4 remains planning-only. The executable proof route uses
  `standard|iblDiffuse|iblSpecularProof|shadowMap|opaque|back|less|none` and
  group 3 bindings, with tests guarding against `pass:bind:4`.
- The GLTF browser proof now covers three independent visible deltas:
  diffuse IBL enabled versus disabled, placeholder specular IBL enabled versus
  disabled, and strict receiver shadow enabled versus disabled.
- No package-boundary drift was found in the audit scan: WebGPU handles remain
  in `@aperture-engine/webgpu`, with `@aperture-engine/render` and
  `@aperture-engine/simulation` staying renderer-independent.

## Recommended Next Slice

Move back to the glTF scene track with a focused import/fidelity slice:
add a minimal uncompressed GLB container fixture path that feeds the existing
scene data contract, without expanding material features further. This keeps the
runtime moving toward real glTF/GLB scene ingestion now that the built-in
material IBL/shadow browser proofs exist.
