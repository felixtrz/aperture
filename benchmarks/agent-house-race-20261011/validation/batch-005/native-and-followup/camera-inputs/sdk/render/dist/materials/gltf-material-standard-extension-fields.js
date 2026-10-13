import { CLEARCOAT_EXTENSION, IRIDESCENCE_EXTENSION, IOR_EXTENSION, SHEEN_EXTENSION, TRANSMISSION_EXTENSION, VOLUME_EXTENSION, } from "./gltf-material-extensions.js";
import { mapFiniteNumber, mapVec3 } from "./gltf-material-scalars.js";
import { mapTextureBinding } from "./gltf-material-textures.js";
export function mapStandardClearcoatFields(input) {
    return {
        clearcoatFactor: mapFiniteNumber({
            materialKey: input.materialKey,
            field: `extensions.${CLEARCOAT_EXTENSION}.clearcoatFactor`,
            value: input.clearcoatSource?.clearcoatFactor,
            fallback: 0,
            diagnostics: input.diagnostics,
        }),
        clearcoatTexture: mapTextureBinding({
            materialKey: input.materialKey,
            slot: "clearcoatTexture",
            field: `extensions.${CLEARCOAT_EXTENSION}.clearcoatTexture`,
            value: input.clearcoatSource?.clearcoatTexture,
            resolver: input.resolver,
            diagnostics: input.diagnostics,
        }),
        clearcoatRoughnessFactor: mapFiniteNumber({
            materialKey: input.materialKey,
            field: `extensions.${CLEARCOAT_EXTENSION}.clearcoatRoughnessFactor`,
            value: input.clearcoatSource?.clearcoatRoughnessFactor,
            fallback: 0,
            diagnostics: input.diagnostics,
        }),
        clearcoatRoughnessTexture: mapTextureBinding({
            materialKey: input.materialKey,
            slot: "clearcoatRoughnessTexture",
            field: `extensions.${CLEARCOAT_EXTENSION}.clearcoatRoughnessTexture`,
            value: input.clearcoatSource?.clearcoatRoughnessTexture,
            resolver: input.resolver,
            diagnostics: input.diagnostics,
        }),
    };
}
export function mapStandardTransmissionFields(input) {
    return {
        transmissionFactor: input.transmissionFactor,
        transmissionTexture: mapTextureBinding({
            materialKey: input.materialKey,
            slot: "transmissionTexture",
            field: `extensions.${TRANSMISSION_EXTENSION}.transmissionTexture`,
            value: input.transmissionSource?.transmissionTexture,
            resolver: input.resolver,
            diagnostics: input.diagnostics,
        }),
    };
}
export function mapStandardVolumeFields(input) {
    return {
        // KHR_materials_ior.ior (default 1.5).
        ior: mapFiniteNumber({
            materialKey: input.materialKey,
            field: `extensions.${IOR_EXTENSION}.ior`,
            value: input.iorSource?.ior,
            fallback: 1.5,
            diagnostics: input.diagnostics,
        }),
        // KHR_materials_volume.thicknessFactor (default 0 = no bounded volume).
        thickness: mapFiniteNumber({
            materialKey: input.materialKey,
            field: `extensions.${VOLUME_EXTENSION}.thicknessFactor`,
            value: input.volumeSource?.thicknessFactor,
            fallback: 0,
            diagnostics: input.diagnostics,
        }),
        // KHR_materials_volume.attenuationColor (default white = no tint).
        attenuationColor: mapVec3({
            materialKey: input.materialKey,
            field: `extensions.${VOLUME_EXTENSION}.attenuationColor`,
            value: input.volumeSource?.attenuationColor,
            fallback: [1, 1, 1],
            diagnostics: input.diagnostics,
        }),
        // KHR_materials_volume.attenuationDistance. The glTF default is +Infinity
        // (no absorption); the engine stores that as the JSON-safe sentinel 0. A
        // bounded volume must specify a positive distance.
        attenuationDistance: mapAttenuationDistance({
            materialKey: input.materialKey,
            field: `extensions.${VOLUME_EXTENSION}.attenuationDistance`,
            value: input.volumeSource?.attenuationDistance,
            diagnostics: input.diagnostics,
        }),
    };
}
function mapAttenuationDistance(input) {
    // Absent => no bounded absorption (glTF +Infinity), stored as the sentinel 0.
    if (input.value === undefined) {
        return 0;
    }
    if (typeof input.value === "number" && Number.isFinite(input.value)) {
        if (input.value > 0) {
            return input.value;
        }
        input.diagnostics.push({
            code: "gltfMaterial.invalidField",
            severity: "error",
            materialKey: input.materialKey,
            field: input.field,
            message: `${input.field} must be a positive number.`,
        });
        return 0;
    }
    input.diagnostics.push({
        code: "gltfMaterial.invalidField",
        severity: "error",
        materialKey: input.materialKey,
        field: input.field,
        message: `${input.field} must be a positive finite number.`,
    });
    return 0;
}
export function mapStandardSheenFields(input) {
    return {
        sheenColorFactor: mapVec3({
            materialKey: input.materialKey,
            field: `extensions.${SHEEN_EXTENSION}.sheenColorFactor`,
            value: input.sheenSource?.sheenColorFactor,
            fallback: [0, 0, 0],
            diagnostics: input.diagnostics,
        }),
        sheenColorTexture: mapTextureBinding({
            materialKey: input.materialKey,
            slot: "sheenColorTexture",
            field: `extensions.${SHEEN_EXTENSION}.sheenColorTexture`,
            value: input.sheenSource?.sheenColorTexture,
            resolver: input.resolver,
            diagnostics: input.diagnostics,
        }),
        sheenRoughnessFactor: mapFiniteNumber({
            materialKey: input.materialKey,
            field: `extensions.${SHEEN_EXTENSION}.sheenRoughnessFactor`,
            value: input.sheenSource?.sheenRoughnessFactor,
            fallback: 0,
            diagnostics: input.diagnostics,
        }),
        sheenRoughnessTexture: mapTextureBinding({
            materialKey: input.materialKey,
            slot: "sheenRoughnessTexture",
            field: `extensions.${SHEEN_EXTENSION}.sheenRoughnessTexture`,
            value: input.sheenSource?.sheenRoughnessTexture,
            resolver: input.resolver,
            diagnostics: input.diagnostics,
        }),
    };
}
export function mapStandardIridescenceFields(input) {
    return {
        iridescenceFactor: mapFiniteNumber({
            materialKey: input.materialKey,
            field: `extensions.${IRIDESCENCE_EXTENSION}.iridescenceFactor`,
            value: input.iridescenceSource?.iridescenceFactor,
            fallback: 0,
            diagnostics: input.diagnostics,
        }),
        iridescenceTexture: mapTextureBinding({
            materialKey: input.materialKey,
            slot: "iridescenceTexture",
            field: `extensions.${IRIDESCENCE_EXTENSION}.iridescenceTexture`,
            value: input.iridescenceSource?.iridescenceTexture,
            resolver: input.resolver,
            diagnostics: input.diagnostics,
        }),
        iridescenceThicknessTexture: mapTextureBinding({
            materialKey: input.materialKey,
            slot: "iridescenceThicknessTexture",
            field: `extensions.${IRIDESCENCE_EXTENSION}.iridescenceThicknessTexture`,
            value: input.iridescenceSource?.iridescenceThicknessTexture,
            resolver: input.resolver,
            diagnostics: input.diagnostics,
        }),
        iridescenceIor: mapFiniteNumber({
            materialKey: input.materialKey,
            field: `extensions.${IRIDESCENCE_EXTENSION}.iridescenceIor`,
            value: input.iridescenceSource?.iridescenceIor,
            fallback: 1.3,
            diagnostics: input.diagnostics,
        }),
        iridescenceThicknessMinimum: mapFiniteNumber({
            materialKey: input.materialKey,
            field: `extensions.${IRIDESCENCE_EXTENSION}.iridescenceThicknessMinimum`,
            value: input.iridescenceSource?.iridescenceThicknessMinimum,
            fallback: 100,
            diagnostics: input.diagnostics,
        }),
        iridescenceThicknessMaximum: mapFiniteNumber({
            materialKey: input.materialKey,
            field: `extensions.${IRIDESCENCE_EXTENSION}.iridescenceThicknessMaximum`,
            value: input.iridescenceSource?.iridescenceThicknessMaximum,
            fallback: 400,
            diagnostics: input.diagnostics,
        }),
    };
}
//# sourceMappingURL=gltf-material-standard-extension-fields.js.map