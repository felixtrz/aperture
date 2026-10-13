import type { StandardMaterialAsset } from "@aperture-engine/render";

export function isScalarStandardMaterial(
  material: StandardMaterialAsset,
): boolean {
  return (
    material.baseColorTexture === null &&
    material.metallicRoughnessTexture === null &&
    material.clearcoatTexture === null &&
    material.clearcoatRoughnessTexture === null &&
    material.transmissionTexture === null &&
    material.sheenColorTexture === null &&
    material.sheenRoughnessTexture === null &&
    material.iridescenceTexture === null &&
    material.iridescenceThicknessTexture === null &&
    material.normalTexture === null &&
    material.occlusionTexture === null &&
    material.emissiveTexture === null
  );
}

export function isBaseColorOnlyStandardMaterial(
  material: StandardMaterialAsset,
): boolean {
  return (
    material.baseColorTexture !== null &&
    material.metallicRoughnessTexture === null &&
    material.clearcoatTexture === null &&
    material.clearcoatRoughnessTexture === null &&
    material.transmissionTexture === null &&
    material.sheenColorTexture === null &&
    material.sheenRoughnessTexture === null &&
    material.iridescenceTexture === null &&
    material.iridescenceThicknessTexture === null &&
    material.normalTexture === null &&
    material.occlusionTexture === null &&
    material.emissiveTexture === null
  );
}

export function isMetallicRoughnessOnlyStandardMaterial(
  material: StandardMaterialAsset,
): boolean {
  return (
    material.baseColorTexture === null &&
    material.metallicRoughnessTexture !== null &&
    material.clearcoatTexture === null &&
    material.clearcoatRoughnessTexture === null &&
    material.transmissionTexture === null &&
    material.sheenColorTexture === null &&
    material.sheenRoughnessTexture === null &&
    material.iridescenceTexture === null &&
    material.iridescenceThicknessTexture === null &&
    material.normalTexture === null &&
    material.occlusionTexture === null &&
    material.emissiveTexture === null
  );
}

export function isNormalOnlyStandardMaterial(
  material: StandardMaterialAsset,
): boolean {
  return (
    material.baseColorTexture === null &&
    material.metallicRoughnessTexture === null &&
    material.clearcoatTexture === null &&
    material.clearcoatRoughnessTexture === null &&
    material.transmissionTexture === null &&
    material.sheenColorTexture === null &&
    material.sheenRoughnessTexture === null &&
    material.iridescenceTexture === null &&
    material.iridescenceThicknessTexture === null &&
    material.normalTexture !== null &&
    material.occlusionTexture === null &&
    material.emissiveTexture === null
  );
}

export function isOcclusionEmissiveOnlyStandardMaterial(
  material: StandardMaterialAsset,
): boolean {
  return (
    material.baseColorTexture === null &&
    material.metallicRoughnessTexture === null &&
    material.clearcoatTexture === null &&
    material.clearcoatRoughnessTexture === null &&
    material.transmissionTexture === null &&
    material.sheenColorTexture === null &&
    material.sheenRoughnessTexture === null &&
    material.iridescenceTexture === null &&
    material.iridescenceThicknessTexture === null &&
    material.normalTexture === null &&
    (material.occlusionTexture !== null || material.emissiveTexture !== null)
  );
}

export function isClearcoatOnlyStandardMaterial(
  material: StandardMaterialAsset,
): boolean {
  return (
    material.baseColorTexture === null &&
    material.metallicRoughnessTexture === null &&
    material.clearcoatTexture !== null &&
    material.clearcoatRoughnessTexture === null &&
    material.transmissionTexture === null &&
    material.sheenColorTexture === null &&
    material.sheenRoughnessTexture === null &&
    material.iridescenceTexture === null &&
    material.iridescenceThicknessTexture === null &&
    material.normalTexture === null &&
    material.occlusionTexture === null &&
    material.emissiveTexture === null
  );
}

export function isClearcoatRoughnessOnlyStandardMaterial(
  material: StandardMaterialAsset,
): boolean {
  return (
    material.baseColorTexture === null &&
    material.metallicRoughnessTexture === null &&
    material.clearcoatTexture === null &&
    material.clearcoatRoughnessTexture !== null &&
    material.transmissionTexture === null &&
    material.sheenColorTexture === null &&
    material.sheenRoughnessTexture === null &&
    material.iridescenceTexture === null &&
    material.iridescenceThicknessTexture === null &&
    material.normalTexture === null &&
    material.occlusionTexture === null &&
    material.emissiveTexture === null
  );
}

export function isTransmissionOnlyStandardMaterial(
  material: StandardMaterialAsset,
): boolean {
  return (
    material.baseColorTexture === null &&
    material.metallicRoughnessTexture === null &&
    material.clearcoatTexture === null &&
    material.clearcoatRoughnessTexture === null &&
    material.transmissionTexture !== null &&
    material.sheenColorTexture === null &&
    material.sheenRoughnessTexture === null &&
    material.iridescenceTexture === null &&
    material.iridescenceThicknessTexture === null &&
    material.normalTexture === null &&
    material.occlusionTexture === null &&
    material.emissiveTexture === null
  );
}

export function isSheenColorOnlyStandardMaterial(
  material: StandardMaterialAsset,
): boolean {
  return (
    material.baseColorTexture === null &&
    material.metallicRoughnessTexture === null &&
    material.clearcoatTexture === null &&
    material.clearcoatRoughnessTexture === null &&
    material.transmissionTexture === null &&
    material.sheenColorTexture !== null &&
    material.sheenRoughnessTexture === null &&
    material.iridescenceTexture === null &&
    material.iridescenceThicknessTexture === null &&
    material.normalTexture === null &&
    material.occlusionTexture === null &&
    material.emissiveTexture === null
  );
}

export function isSheenRoughnessOnlyStandardMaterial(
  material: StandardMaterialAsset,
): boolean {
  return (
    material.baseColorTexture === null &&
    material.metallicRoughnessTexture === null &&
    material.clearcoatTexture === null &&
    material.clearcoatRoughnessTexture === null &&
    material.transmissionTexture === null &&
    material.sheenColorTexture === null &&
    material.sheenRoughnessTexture !== null &&
    material.iridescenceTexture === null &&
    material.iridescenceThicknessTexture === null &&
    material.normalTexture === null &&
    material.occlusionTexture === null &&
    material.emissiveTexture === null
  );
}

export function isIridescenceOnlyStandardMaterial(
  material: StandardMaterialAsset,
): boolean {
  return (
    material.baseColorTexture === null &&
    material.metallicRoughnessTexture === null &&
    material.clearcoatTexture === null &&
    material.clearcoatRoughnessTexture === null &&
    material.transmissionTexture === null &&
    material.sheenColorTexture === null &&
    material.sheenRoughnessTexture === null &&
    material.iridescenceTexture !== null &&
    material.iridescenceThicknessTexture === null &&
    material.normalTexture === null &&
    material.occlusionTexture === null &&
    material.emissiveTexture === null
  );
}

export function isIridescenceThicknessOnlyStandardMaterial(
  material: StandardMaterialAsset,
): boolean {
  return (
    material.baseColorTexture === null &&
    material.metallicRoughnessTexture === null &&
    material.clearcoatTexture === null &&
    material.clearcoatRoughnessTexture === null &&
    material.transmissionTexture === null &&
    material.sheenColorTexture === null &&
    material.sheenRoughnessTexture === null &&
    material.iridescenceTexture === null &&
    material.iridescenceThicknessTexture !== null &&
    material.normalTexture === null &&
    material.occlusionTexture === null &&
    material.emissiveTexture === null
  );
}
