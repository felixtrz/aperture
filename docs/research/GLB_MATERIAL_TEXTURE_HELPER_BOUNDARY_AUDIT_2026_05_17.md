# GLB Material And Texture Helper Boundary Audit - 2026-05-17

## Scope

Audited the current GLB material, sampler, and texture/image helper modules:

- `packages/render/src/materials/gltf-material.ts`
- `packages/render/src/materials/gltf-sampler.ts`
- `packages/render/src/materials/gltf-texture.ts`

Reference anchors inspected:

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/research/MINIMAL_GLB_MATERIAL_MAPPING_PLAN_2026_05_17.md`
- `docs/research/MINIMAL_GLB_TEXTURE_IMAGE_MAPPING_PLAN_2026_05_17.md`
- three.js `GLTFLoader` material, sampler, image, and texture loading patterns
- PlayCanvas `glb-parser` material and texture creation patterns
- Bevy glTF image/material loading and sampler descriptor mapping

## Boundary Check

No package-boundary or ownership drift was found.

- The helpers live in `packages/render`, import only renderer-independent
  material factories/types and helper modules, and do not import
  `@aperture-engine/webgpu`.
- The helpers produce source assets (`StandardMaterialAsset`,
  `UnlitMaterialAsset`, `TextureAsset`, and `SamplerAsset`) plus diagnostics.
- Texture and sampler handle resolution remains caller-owned.
- Image decoding remains caller-owned through `resolveImageData`.
- The helpers do not mutate `AssetRegistry`, spawn ECS entities, create
  snapshots, fetch network/file resources, use DOM/browser APIs, or allocate GPU
  resources.
- Texture report JSON summaries omit raw `Uint8Array` payloads and expose byte
  lengths/stride instead.

## Validation

- `pnpm run check:boundaries`
- `pnpm exec vitest run test/materials/gltf-texture.test.ts
test/materials/gltf-material.test.ts test/materials/gltf-sampler.test.ts`

Both passed.

## Result

The GLB helper set is still a render-bridge source-data layer, not a loader
or renderer. It is safe to continue with narrow GLB asset mapping slices as long
as the next work keeps image decoding, registry mutation, ECS authoring, and
WebGPU preparation in separate explicit contracts.

Recommended next slices:

1. Add a test-only fixture that connects texture mapping reports to material
   resolver results without registering assets.
2. Add a glTF JSON root validation helper for `asset.version`, required
   extension declarations, and arrays needed by material/texture mapping.
3. Audit again before adding asset-registry mutation or ECS authoring commands.
