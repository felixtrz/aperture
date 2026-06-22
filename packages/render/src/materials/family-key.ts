import {
  BUILT_IN_MATERIAL_KINDS,
  type CustomWgslMaterialAsset,
  type MaterialKind,
  type SourceMaterialAsset,
} from "./types.js";

export function isBuiltInMaterialKind(value: string): value is MaterialKind {
  return (BUILT_IN_MATERIAL_KINDS as readonly string[]).includes(value);
}

export function isValidCustomMaterialFamilyKey(value: string): boolean {
  if (isBuiltInMaterialKind(value) || value.includes("|")) {
    return false;
  }

  return /^[a-z][a-z0-9_.-]*\/[a-z][a-z0-9_.-]*(?:\/[a-z][a-z0-9_.-]*)*$/.test(
    value,
  );
}

export function isValidMaterialFamilyKey(value: string): boolean {
  return isBuiltInMaterialKind(value) || isValidCustomMaterialFamilyKey(value);
}

export function isCustomWgslMaterialAsset(
  material: SourceMaterialAsset,
): material is CustomWgslMaterialAsset {
  return (
    "sourceDiscriminator" in material &&
    material.sourceDiscriminator === "custom-material-source" &&
    material.shaderLanguage === "wgsl"
  );
}
