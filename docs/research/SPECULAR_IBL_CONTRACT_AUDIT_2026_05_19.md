# Specular IBL Contract Audit

Date: 2026-05-19

## Scope

Decide the next narrow step before any StandardMaterial specular IBL shader
sampling.

## Reference Anchors

- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/research/DIFFUSE_IBL_ROUTE_OWNERSHIP_AUDIT_2026_05_19.md`
- `packages/webgpu/src/webgpu/ibl-texture-resource.ts`
- `packages/webgpu/src/webgpu/standard-material-ibl-bind-group.ts`
- PlayCanvas-style environment prefiltering in
  `references/engine/src/scene/graphics/reproject-texture.js` and reflection
  WGSL chunks.
- three.js PMREM references in `references/three.js/src/extras/PMREMGenerator.js`.

## Findings

- The current specular IBL resource is a renderer-owned cube texture/view
  allocation, but it does not yet carry meaningful prefiltered radiance. A
  shader proof that samples it directly would be a route proof, not a useful
  material-fidelity proof.
- Both reference engines treat specular IBL as prefiltered environment radiance
  selected by roughness. PlayCanvas uses reflection/prefilter paths with GGX or
  Phong sample distributions; three.js PMREM precomputes roughness-dependent
  radiance levels. Aperture should not pretend an unfiltered placeholder is
  equivalent to that contract.
- The existing combined group 3 bridge has room for a specular texture binding,
  but the source/prepared-resource readiness must distinguish "allocated" from
  "prefiltered/uploaded enough for shader proof".
- Group 4 can continue to report diffuse/specular/sampler planning identity.
  The executable browser variant should remain group 3 and should add specular
  only when the prepared specular resource is meaningful enough for a visible
  proof.

## Decision

Do not implement specular IBL shader sampling as the next code slice. First add
a minimal renderer-owned specular IBL upload/prefilter placeholder contract that
is honest: either a constant radiance upload marked as a proof placeholder, or a
small one-level roughness resource with diagnostics saying full PMREM/GGX
prefiltering is deferred.

## Recommended Next Slice

Implement a minimal specular IBL texture upload readiness slice:

- Add JSON-safe diagnostics distinguishing allocated specular texture resources
  from uploaded/prefiltered specular proof resources.
- Upload deterministic placeholder radiance to the existing specular cube
  texture when a queue is available, similar to the diffuse proof upload.
- Keep full PMREM/GGX convolution deferred and explicit in status.
- Add tests proving the specular resource is renderer-owned, JSON-safe, and not
  treated as full PBR readiness.
