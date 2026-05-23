import type { MaterialAsset, MaterialTextureBinding } from "./types.js";

export function materialTextureBindings(
  material: MaterialAsset,
): readonly (readonly [string, MaterialTextureBinding])[] {
  switch (material.kind) {
    case "unlit":
      return optionalBindings([
        ["baseColorTexture", material.baseColorTexture],
      ]);
    case "matcap":
      return [
        [
          "matcapTexture",
          material.matcapTexture ?? { texture: null, sampler: null },
        ],
      ];
    case "standard":
      return optionalBindings([
        ["baseColorTexture", material.baseColorTexture],
        ["metallicRoughnessTexture", material.metallicRoughnessTexture],
        ["clearcoatTexture", material.clearcoatTexture],
        ["transmissionTexture", material.transmissionTexture],
        ["normalTexture", material.normalTexture],
        ["occlusionTexture", material.occlusionTexture],
        ["emissiveTexture", material.emissiveTexture],
      ]);
    case "debug-normal":
      return [];
  }
}

function optionalBindings(
  bindings: readonly (readonly [string, MaterialTextureBinding | null])[],
): readonly (readonly [string, MaterialTextureBinding])[] {
  return bindings.filter(
    (binding): binding is readonly [string, MaterialTextureBinding] =>
      binding[1] !== null,
  );
}
