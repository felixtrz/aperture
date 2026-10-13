export const CLEARCOAT_EXTENSION = "KHR_materials_clearcoat";
export const TRANSMISSION_EXTENSION = "KHR_materials_transmission";
export const SHEEN_EXTENSION = "KHR_materials_sheen";
export const IRIDESCENCE_EXTENSION = "KHR_materials_iridescence";
export const IOR_EXTENSION = "KHR_materials_ior";
export const VOLUME_EXTENSION = "KHR_materials_volume";
const SUPPORTED_MATERIAL_EXTENSIONS = new Set([
    "KHR_materials_unlit",
    CLEARCOAT_EXTENSION,
    TRANSMISSION_EXTENSION,
    SHEEN_EXTENSION,
    IRIDESCENCE_EXTENSION,
    IOR_EXTENSION,
    VOLUME_EXTENSION,
]);
export function inspectUnsupportedClearcoatTextures(clearcoatSource, materialKey, diagnostics) {
    if (clearcoatSource === undefined) {
        return;
    }
    for (const field of ["clearcoatNormalTexture"]) {
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
export function inspectMaterialExtensions(input) {
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
export function inspectUnsupportedUnlitFields(material, pbr, materialKey, diagnostics) {
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
    ];
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
//# sourceMappingURL=gltf-material-extensions.js.map