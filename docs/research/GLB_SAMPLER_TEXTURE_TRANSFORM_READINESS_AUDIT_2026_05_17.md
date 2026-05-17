# GLB Sampler And Texture-Transform Readiness Audit - 2026-05-17

## Scope

Audited the new renderer-independent GLB material helpers after:

- `task-0650` added glTF sampler to `SamplerAsset` mapping.
- `task-0651` planned minimal GLB material mapping.
- `task-0652` added the first GLB material mapping skeleton.

Reference anchors inspected:

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/STANDARD_MATERIAL_PBR_TEXTURE_EXPECTATIONS_AUDIT_2026_05_17.md`
- `docs/research/MINIMAL_GLB_MATERIAL_MAPPING_PLAN_2026_05_17.md`
- `references/three.js/examples/jsm/loaders/GLTFLoader.js`
- `references/engine/src/framework/parsers/glb-parser.js`
- `references/bevy/crates/bevy_gltf/src/loader/mod.rs`
- `references/bevy/crates/bevy_gltf/src/loader/gltf_ext/texture.rs`

## Findings

No WebGPU ownership drift was found.

- `packages/render/src/materials/gltf-sampler.ts` only maps glTF sampler enum
  values into `SamplerAsset` source data and JSON-safe diagnostics.
- `packages/render/src/materials/gltf-material.ts` only maps plain glTF-like
  material JSON into `UnlitMaterialAsset` or `StandardMaterialAsset`.
- Texture and sampler handles arrive through a caller-provided resolver. The
  mapper does not decode images, create texture assets, mutate an asset
  registry, spawn ECS entities, create render snapshots, or allocate GPU
  resources.
- The material mapper preserves texture transform metadata in
  `MaterialTextureBinding.transform` and emits a JSON-safe warning for
  non-identity transforms. StandardMaterial readiness still blocks unsupported
  transforms before WebGPU preparation.
- Unsupported required material extensions are errors; unsupported optional
  material extensions are warnings. This keeps import behavior honest without
  pretending unsupported PBR features are rendered.

One small drift was found and fixed during the audit:

- Malformed `extensions` and `pbrMetallicRoughness` values could previously
  fall back to defaults without a diagnostic. The mapper now reports
  `gltfMaterial.invalidField`, and focused tests cover the malformed case.

## Result

The GLB sampler, texture-transform, and material-mapping helpers currently stay
inside the render-bridge boundary. They align with the Bevy-style asset-source
pattern while adapting three.js and PlayCanvas material mapping concepts to
Aperture's ECS-authoritative, WebGPU-owned renderer architecture.

Next work should keep GLB import slices narrow:

1. Add alpha-mode and double-sided render-state mapping tests around the GLB
   material helper.
2. Add texture binding resolver diagnostics for texture/sampler index lookup
   failures once the GLB texture asset mapping slice exists.
3. Audit package boundaries again before connecting material mapping to broader
   GLB scene or asset registry loading.
