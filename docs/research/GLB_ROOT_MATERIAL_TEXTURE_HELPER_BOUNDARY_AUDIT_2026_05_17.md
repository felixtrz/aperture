# GLB Root/Material/Texture Helper Boundary Audit - 2026-05-17

## Scope

Audited the expanded GLB helper set after adding:

- glTF root validation,
- sampler mapping,
- texture/image source-data mapping,
- material mapping,
- material/texture resolver fixture tests,
- report JSON fixture tests.

Reference anchors inspected:

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/research/MINIMAL_GLB_MATERIAL_MAPPING_PLAN_2026_05_17.md`
- `docs/research/MINIMAL_GLB_TEXTURE_IMAGE_MAPPING_PLAN_2026_05_17.md`
- three.js `GLTFLoader`
- PlayCanvas `glb-parser`
- Bevy glTF loading and sampler/image handling

## Boundary Result

No drift was found.

- `packages/render/src/assets/gltf-root.ts` validates root JSON shape only. It
  does not parse GLB bytes, load buffers, mutate assets, author ECS state, or
  touch renderer APIs.
- `packages/render/src/materials/gltf-texture.ts` maps texture/image/sampler
  metadata into source assets using a caller-owned decoded-image resolver. It
  does not decode images, fetch URIs, generate mipmaps, register assets, or
  create GPU resources.
- `packages/render/src/materials/gltf-material.ts` maps material JSON into
  source material assets using a caller-owned texture-binding resolver. It does
  not know about asset registries, render snapshots, render worlds, or WebGPU.
- Report JSON helpers keep diagnostics and metadata JSON-safe. Texture reports
  summarize binary payloads by byte length and stride rather than embedding
  `Uint8Array` contents.

## Validation

- `pnpm run check:boundaries`
- `pnpm exec vitest run test/assets/gltf-root.test.ts
test/materials/gltf-report-json.test.ts
test/materials/gltf-material-texture-integration.test.ts
test/materials/gltf-texture.test.ts test/materials/gltf-material.test.ts
test/materials/gltf-sampler.test.ts`

Both passed.

## Recommendation

The next GLB slice can start building orchestration around these helpers, but it
should remain explicit:

1. Plan a minimal GLB asset mapping orchestration report that collects root,
   texture, sampler, and material reports without mutating registries.
2. Add asset-registry mutation only after the orchestration report shape is
   tested.
3. Keep ECS authoring commands as a separate slice after typed assets can be
   planned/registered.
