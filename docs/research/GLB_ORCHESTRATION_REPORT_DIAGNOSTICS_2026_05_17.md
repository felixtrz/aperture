# GLB Orchestration Report Diagnostics - 2026-05-17

## Purpose

Document the current `GltfAssetMappingReport` lifecycle before asset registry
mutation exists.

The orchestration report is a planning layer:

```text
glTF root JSON
  -> root validation report
  -> texture/sampler source asset reports
  -> material source asset reports
  -> planned handle keys and merged diagnostics
```

It answers what would be registered later, but does not register anything.

## Valid Mapping Example

For a material with `baseColorTexture.index = 0`, the report plans deterministic
keys:

```text
gltf:texture:0:baseColorTexture
gltf:sampler:0:baseColorTexture
material:gltf:material:0
```

The material mapper receives those planned texture/sampler handles through its
resolver and stores them in the material source asset. This keeps material
mapping independent from the future asset registry mutation step.

## Failed Texture Decode Example

A texture image resolver failure remains visible at both layers:

- texture layer: `gltfTexture.imageResolverFailed`
- material layer: `gltfMaterial.unresolvedTextureBinding`

The material diagnostic keeps `dependencyKind: "texture"` and the source
`textureIndex`, so a caller can explain that the material did not map because
the texture source was unavailable, not because the material JSON itself was
malformed.

## Unsupported Required Extension Example

Root validation reports unsupported required root extensions before helper
mapping proceeds:

```json
{
  "layer": "root",
  "code": "gltfRoot.unsupportedRequiredExtension",
  "severity": "error",
  "field": "extensionsRequired"
}
```

Texture-level required extension failures are preserved separately:

```json
{
  "layer": "texture",
  "code": "gltfTexture.unsupportedRequiredTextureExtension",
  "severity": "error",
  "textureIndex": 0,
  "slot": "baseColorTexture"
}
```

## Later Registry Handoff

The future registry mutation slice should consume only successful planned
entries:

- `report.textures[*].texture` with `report.textures[*].handleKey`
- `report.samplers[*].sampler` with `report.samplers[*].handleKey`
- `report.materials[*].material` with `report.materials[*].handleKey`

That later slice should be mechanical: add source assets under the planned keys,
then surface the same diagnostics if a planned entry is null or invalid. ECS
entity authoring should still remain a separate slice after typed assets can be
planned and registered.
