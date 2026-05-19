# Specular IBL Resource Allocation Slice Plan — 2026-05-19

## Task

Completed `task-1848`: plan the next IBL resource slice after group 4
descriptor planning exposed the missing specular prefilter texture resource.

## Reference Anchors

- `packages/webgpu/src/webgpu/ibl-texture-preparation.ts`
- `packages/webgpu/src/webgpu/ibl-texture-resource.ts`
- `packages/webgpu/src/webgpu/standard-material-ibl-bind-group.ts`
- `references/engine/src/scene/graphics/env-lighting.js`
- `references/three.js/src/extras/PMREMGenerator.js`

## Reference Pattern

Both local references treat specular IBL as a prepared environment resource,
not as source scene state.

- PlayCanvas builds environment lighting resources from source environment
  textures and uses mip/prefilter work before runtime sampling.
- three.js PMREM prepares a derived radiance texture that material sampling can
  consume by roughness.

Aperture's next step should stay smaller than full PMREM/pass execution:
allocate a renderer-owned specular texture/view resource from the existing
specular preparation slot, with the right texture shape and JSON-safe
diagnostics. Actual convolution/prefilter pass submission can remain deferred.

## Selected Follow-Up

Add `task-1849`: allocate the specular IBL texture resource.

The implementation should mirror `createDiffuseIblTextureResourceReport()` but
filter `IblTexturePreparationSlot.kind === "specular"` and create one
renderer-owned cube texture/view resource using the planned specular texture key.

Recommended descriptor:

- label: `<environmentMapResourceKey>:specular-ibl`;
- format: slot format (`rgba16float` today);
- usage: `TEXTURE_BINDING | RENDER_ATTACHMENT | COPY_DST`;
- mip levels: computed from the configured specular size; and
- size: default `128 x 128 x 6` unless an explicit test size is passed.

## Acceptance For Follow-Up Implementation

- Add a `SpecularIblTextureResourceReport` with JSON helpers.
- Allocate only specular IBL texture/view resources from planned specular slots.
- Report created texture count, resource keys, mip count, and deferred prefilter
  upload/pass state.
- Update GLTF scene status/readiness with `ibl.specularTextureResource`.
- Keep prefilter shader/pass execution, bind-group creation, and WGSL sampling
  deferred.

## Deferred

- GGX/PMREM convolution shaders.
- Prefilter pass command encoding.
- Environment resource app-cache integration.
- Valid group 4 live bind-group creation.
