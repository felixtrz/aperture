import { mapBaseColorFactor, mapFiniteNumber, mapVec3, } from "./gltf-material-scalars.js";
import { mapTextureBinding } from "./gltf-material-textures.js";
import { recordField } from "./gltf-material-utils.js";
export function mapStandardPbrFields(input) {
    return {
        baseColorFactor: mapBaseColorFactor({
            materialKey: input.materialKey,
            field: "pbrMetallicRoughness.baseColorFactor",
            value: input.pbrSource.baseColorFactor,
            diagnostics: input.diagnostics,
        }),
        baseColorTexture: mapTextureBinding({
            materialKey: input.materialKey,
            slot: "baseColorTexture",
            field: "pbrMetallicRoughness.baseColorTexture",
            value: input.pbrSource.baseColorTexture,
            resolver: input.resolver,
            diagnostics: input.diagnostics,
        }),
        metallicFactor: mapFiniteNumber({
            materialKey: input.materialKey,
            field: "pbrMetallicRoughness.metallicFactor",
            value: input.pbrSource.metallicFactor,
            fallback: 1,
            diagnostics: input.diagnostics,
        }),
        roughnessFactor: mapFiniteNumber({
            materialKey: input.materialKey,
            field: "pbrMetallicRoughness.roughnessFactor",
            value: input.pbrSource.roughnessFactor,
            fallback: 1,
            diagnostics: input.diagnostics,
        }),
        metallicRoughnessTexture: mapTextureBinding({
            materialKey: input.materialKey,
            slot: "metallicRoughnessTexture",
            field: "pbrMetallicRoughness.metallicRoughnessTexture",
            value: input.pbrSource.metallicRoughnessTexture,
            resolver: input.resolver,
            diagnostics: input.diagnostics,
        }),
    };
}
export function mapStandardSurfaceFields(input) {
    return {
        normalTexture: mapTextureBinding({
            materialKey: input.materialKey,
            slot: "normalTexture",
            field: "normalTexture",
            value: input.material.normalTexture,
            resolver: input.resolver,
            diagnostics: input.diagnostics,
        }),
        normalScale: mapFiniteNumber({
            materialKey: input.materialKey,
            field: "normalTexture.scale",
            value: recordField(input.material, "normalTexture")?.scale,
            fallback: 1,
            diagnostics: input.diagnostics,
        }),
        occlusionTexture: mapTextureBinding({
            materialKey: input.materialKey,
            slot: "occlusionTexture",
            field: "occlusionTexture",
            value: input.material.occlusionTexture,
            resolver: input.resolver,
            diagnostics: input.diagnostics,
        }),
        occlusionStrength: mapFiniteNumber({
            materialKey: input.materialKey,
            field: "occlusionTexture.strength",
            value: recordField(input.material, "occlusionTexture")?.strength,
            fallback: 1,
            diagnostics: input.diagnostics,
        }),
        emissiveFactor: mapVec3({
            materialKey: input.materialKey,
            field: "emissiveFactor",
            value: input.material.emissiveFactor,
            fallback: [0, 0, 0],
            diagnostics: input.diagnostics,
        }),
        emissiveTexture: mapTextureBinding({
            materialKey: input.materialKey,
            slot: "emissiveTexture",
            field: "emissiveTexture",
            value: input.material.emissiveTexture,
            resolver: input.resolver,
            diagnostics: input.diagnostics,
        }),
    };
}
//# sourceMappingURL=gltf-material-standard-fields.js.map