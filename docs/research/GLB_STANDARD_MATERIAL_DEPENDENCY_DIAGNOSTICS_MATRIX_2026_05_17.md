# GLB StandardMaterial Dependency Diagnostics Matrix - 2026-05-17

## Scope

Plan the remaining GLB-shaped StandardMaterial texture and sampler dependency
diagnostics coverage.

This is a planning slice only. It does not change glTF asset mapping, source
registration, readiness reports, browser fixtures, WebGPU resource preparation,
or rendering.

## References Inspected

- `references/bevy/crates/bevy_asset/src/loader.rs`
- `references/bevy/crates/bevy_asset/src/render_asset.rs`
- `references/bevy/crates/bevy_pbr/src/lib.rs`
- `references/bevy/crates/bevy_gltf/src/loader/mod.rs`
- `packages/render/src/assets/gltf-asset-mapping.ts`
- `packages/render/src/assets/gltf-source-registration.ts`
- `packages/render/src/materials/gltf-material.ts`
- `packages/render/src/materials/gltf-texture.ts`
- `packages/render/src/materials/dependency-readiness.ts`
- `packages/render/src/materials/standard-texture-readiness.ts`
- `test/assets/gltf-asset-mapping.test.ts`
- `test/assets/gltf-source-registration-dependencies.test.ts`
- `test/materials/material-dependency-readiness.test.ts`
- `test/materials/standard-texture-readiness.test.ts`
- `test/e2e/standard-gltf-texture.spec.ts`

## Reference Pattern

Bevy's asset load context records dependencies while labeled glTF sub-assets are
built, then render-asset usage separates main-world source assets from render
world preparation. Bevy PBR also has an explicit glTF-to-StandardMaterial
switch. Aperture's equivalent should stay source-registry first: glTF mapping
plans source texture, sampler, and material handles; source registration records
dependency edges; readiness reports explain missing, loading, failed, or invalid
source dependencies before WebGPU preparation tries to bind them.

## Current GLB Slot Coverage

All five StandardMaterial texture slots are represented in the current
glTF-shaped path:

| glTF field                                      | StandardMaterial field     | Planned source handles                                                                           | Texture metadata expectation                                  | Browser GLB-shaped fixture |
| ----------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- | -------------------------- |
| `pbrMetallicRoughness.baseColorTexture`         | `baseColorTexture`         | `gltf:texture:<index>:baseColorTexture`, `gltf:sampler:<index>:baseColorTexture`                 | semantic `base-color`, color space `srgb`                     | yes                        |
| `pbrMetallicRoughness.metallicRoughnessTexture` | `metallicRoughnessTexture` | `gltf:texture:<index>:metallicRoughnessTexture`, `gltf:sampler:<index>:metallicRoughnessTexture` | semantic `metallic-roughness`, color space `linear` or `data` | yes                        |
| `normalTexture`                                 | `normalTexture`            | `gltf:texture:<index>:normalTexture`, `gltf:sampler:<index>:normalTexture`                       | semantic `normal`, color space `linear` or `data`             | yes                        |
| `occlusionTexture`                              | `occlusionTexture`         | `gltf:texture:<index>:occlusionTexture`, `gltf:sampler:<index>:occlusionTexture`                 | semantic `occlusion`, color space `linear` or `data`          | yes                        |
| `emissiveTexture`                               | `emissiveTexture`          | `gltf:texture:<index>:emissiveTexture`, `gltf:sampler:<index>:emissiveTexture`                   | semantic `emissive`, color space `srgb`                       | yes                        |

`createGltfAssetMappingReport()` collects those slots from the glTF material
shape, creates slot-specific planned texture and sampler handles, and resolves
material texture bindings to those handles. `createTextureAssetFromGltfTexture()`
sets the slot-specific semantic and color space. `registerGltfSourceAssetsFromMappingReport()`
then writes source texture and sampler assets before material assets, and records
material dependency edges for every non-null texture and sampler binding.

## Current Dependency-State Diagnostics

There are two related diagnostic layers:

- `createMaterialDependencyReadinessReport()` checks source dependency state for
  any material family. It reports missing handles plus dependency statuses of
  `missing`, `registered`, `loading`, and `failed` for texture and sampler
  handles. Unit coverage currently exercises StandardMaterial missing, loading,
  and failed dependencies.
- `createStandardMaterialTextureReadinessReport()` checks StandardMaterial slot
  fidelity. It covers missing texture/sampler handles, texture/sampler not-ready
  states, unsupported texCoords, unsupported transforms, invalid texture
  semantics, and invalid color spaces for all five StandardMaterial slots.

The GLB-shaped browser fixture now proves the ready path for base-color,
metallic-roughness, normal, occlusion, and emissive slots. It also publishes
JSON-safe glTF mapping, source registration, sampler mapping, texture readiness,
pipeline, and render-state status for ready scenarios.

## Missing Coverage

The core readiness APIs are not missing diagnostic states, but the GLB-shaped
coverage does not yet deliberately exercise failure or delayed dependency states
with glTF-derived handle names and slot context.

Specific gaps:

- no matrix test creates invalid GLB texture plans for all five slots and proves
  the resulting diagnostics preserve slot, texture index, sampler index, field,
  and dependency kind;
- no matrix test proves source registration skips a GLB-derived material when a
  planned texture or sampler dependency is absent for each slot;
- no GLB-shaped browser fixture shows the app-facing diagnostics for
  `loading`/`failed` GLB-derived texture or sampler source dependencies before
  WebGPU resource preparation;
- no browser fixture verifies that these failure reports remain JSON-safe while
  using GLB-derived material, texture, and sampler handle keys.

## Follow-Up Implementation Slices

### GLB invalid texture/sampler diagnostics matrix

Add targeted render-bridge tests that generate one GLB-shaped material per
slot. Cover an invalid image/texture path and an invalid sampler path. Assert
the mapping diagnostics retain `slot`, `field`, `textureIndex`,
`samplerIndex` when present, and resolver diagnostics classify sampler failures
as sampler dependencies.

This should stay in render/material tests and should not require WebGPU.

### GLB delayed dependency browser diagnostics

Add a narrow browser scenario that uses GLB-derived handle keys and a
StandardMaterial source material, then marks one texture dependency loading,
one texture dependency failed, one sampler dependency loading, and one sampler
dependency failed before rendering. Assert the app report exposes
`materialDependencyReadiness` / texture readiness diagnostics with GLB-derived
keys and no raw asset objects or WebGPU resources.

This should not claim that binary `.glb` loading is implemented.

## Non-Goals

- No binary `.glb` loader changes.
- No renderer-owned material state.
- No WebGPU resource diagnostics for source asset failures.
- No new material-family abstraction.
- No alpha-blend or texture-transform rendering changes.
