import type { GltfMaterialMappingDiagnostic } from "./gltf-material-types.js";

export const CLEARCOAT_EXTENSION = "KHR_materials_clearcoat";
export const TRANSMISSION_EXTENSION = "KHR_materials_transmission";
export const SHEEN_EXTENSION = "KHR_materials_sheen";
export const IRIDESCENCE_EXTENSION = "KHR_materials_iridescence";

const SUPPORTED_MATERIAL_EXTENSIONS = new Set([
  "KHR_materials_unlit",
  CLEARCOAT_EXTENSION,
  TRANSMISSION_EXTENSION,
  SHEEN_EXTENSION,
  IRIDESCENCE_EXTENSION,
]);

export function inspectUnsupportedClearcoatTextures(
  clearcoatSource: Record<string, unknown> | undefined,
  materialKey: string,
  diagnostics: GltfMaterialMappingDiagnostic[],
): void {
  if (clearcoatSource === undefined) {
    return;
  }

  for (const field of ["clearcoatNormalTexture"] as const) {
    if (clearcoatSource[field] === undefined) {
      continue;
    }

    diagnostics.push({
      code: "gltfMaterial.unsupportedOptionalExtension",
      severity: "warning",
      materialKey,
      field: `extensions.${CLEARCOAT_EXTENSION}.${field}`,
      extensionName: CLEARCOAT_EXTENSION,
      message: `${CLEARCOAT_EXTENSION}.${field} is preserved in source data but current clearcoat rendering only samples clearcoatTexture and clearcoatRoughnessTexture.`,
    });
  }
}

export function inspectMaterialExtensions(input: {
  readonly materialKey: string;
  readonly extensions: Record<string, unknown> | undefined;
  readonly required: readonly string[];
  readonly diagnostics: GltfMaterialMappingDiagnostic[];
}): void {
  if (input.extensions === undefined) {
    return;
  }

  const required = new Set(input.required);
  for (const extensionName of Object.keys(input.extensions)) {
    if (SUPPORTED_MATERIAL_EXTENSIONS.has(extensionName)) {
      continue;
    }

    const requiredExtension = required.has(extensionName);
    input.diagnostics.push({
      code: requiredExtension
        ? "gltfMaterial.unsupportedRequiredExtension"
        : "gltfMaterial.unsupportedOptionalExtension",
      severity: requiredExtension ? "error" : "warning",
      materialKey: input.materialKey,
      field: `extensions.${extensionName}`,
      extensionName,
      message: requiredExtension
        ? `Required glTF material extension '${extensionName}' is not supported.`
        : `Optional glTF material extension '${extensionName}' is not rendered by the minimal mapper.`,
    });
  }
}

export function inspectUnsupportedUnlitFields(
  material: Record<string, unknown>,
  pbr: Record<string, unknown>,
  materialKey: string,
  diagnostics: GltfMaterialMappingDiagnostic[],
): void {
  const fields = [
    ["pbrMetallicRoughness.metallicFactor", pbr.metallicFactor],
    ["pbrMetallicRoughness.roughnessFactor", pbr.roughnessFactor],
    [
      "pbrMetallicRoughness.metallicRoughnessTexture",
      pbr.metallicRoughnessTexture,
    ],
    ["normalTexture", material.normalTexture],
    ["occlusionTexture", material.occlusionTexture],
    ["emissiveFactor", material.emissiveFactor],
    ["emissiveTexture", material.emissiveTexture],
  ] as const;

  for (const [field, value] of fields) {
    if (value === undefined) {
      continue;
    }

    diagnostics.push({
      code: "gltfMaterial.unsupportedUnlitField",
      severity: "warning",
      materialKey,
      field,
      message: `${field} is present on a KHR_materials_unlit material and will not affect rendering.`,
    });
  }
}
