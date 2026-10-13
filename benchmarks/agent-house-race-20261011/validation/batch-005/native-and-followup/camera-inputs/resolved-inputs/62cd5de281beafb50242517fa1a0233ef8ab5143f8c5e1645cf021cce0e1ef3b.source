import { assetHandleKey, createMaterialHandle, createSamplerHandle, createTextureHandle, } from "@aperture-engine/simulation";
import { createMaterialAssetFromGltfMaterial, createTextureAssetFromGltfTexture, gltfMaterialMappingReportToJsonValue, gltfTextureMappingReportToJsonValue, } from "../materials/index.js";
import { gltfRootValidationReportToJsonValue, validateGltfRootForAssetMapping, } from "./gltf-root.js";
import { arrayField, collectMaterialTextureSlots, isRecord, plannedHandleKey, samplerSourceForTexture, stringArray, textureDiagnosticToAssetDiagnostic, textureDiagnosticToResolverDiagnostic, textureReportKey, } from "./gltf-asset-mapping-utils.js";
export { gltfAssetMappingReportToJson, gltfAssetMappingReportToJsonValue, } from "./gltf-asset-mapping-report.js";
export function createGltfAssetMappingReport(options) {
    const rootValidation = validateGltfRootForAssetMapping(options.root);
    const root = gltfRootValidationReportToJsonValue(rootValidation);
    const diagnostics = [
        ...rootValidation.diagnostics.map((diagnostic) => ({
            layer: "root",
            code: diagnostic.code,
            severity: diagnostic.severity,
            message: diagnostic.message,
            ...(diagnostic.field === undefined ? {} : { field: diagnostic.field }),
        })),
    ];
    if (!isRecord(options.root)) {
        return {
            valid: false,
            root,
            textures: [],
            samplers: [],
            materials: [],
            diagnostics,
        };
    }
    const materials = Array.isArray(options.root.materials)
        ? options.root.materials
        : [];
    const materialIndices = options.materialIndices ?? materials.map((_, index) => index);
    const textureEntries = new Map();
    const textures = [];
    const samplers = [];
    const plannedMaterials = [];
    const extensionsRequired = stringArray(options.root.extensionsRequired);
    for (const materialIndex of materialIndices) {
        const material = materials[materialIndex];
        const materialKey = plannedHandleKey(options, "material", materialIndex);
        const textureSlots = collectMaterialTextureSlots(material);
        for (const textureSlot of textureSlots) {
            const key = textureReportKey(textureSlot.textureIndex, textureSlot.slot);
            if (textureEntries.has(key)) {
                continue;
            }
            const report = createTextureAssetFromGltfTexture({
                textureIndex: textureSlot.textureIndex,
                slot: textureSlot.slot,
                textures: arrayField(options.root, "textures"),
                images: arrayField(options.root, "images"),
                samplers: arrayField(options.root, "samplers"),
                resolveImageData: options.resolveImageData,
                extensionsRequired,
            });
            const textureHandleKey = plannedHandleKey(options, "texture", textureSlot.textureIndex, textureSlot.slot);
            const samplerHandleKey = plannedHandleKey(options, "sampler", textureSlot.textureIndex, textureSlot.slot);
            textureEntries.set(key, {
                key,
                report,
                textureHandleKey,
                samplerHandleKey,
            });
            textures.push({
                handleKey: textureHandleKey,
                textureIndex: textureSlot.textureIndex,
                slot: textureSlot.slot,
                texture: report.texture,
                report: gltfTextureMappingReportToJsonValue(report),
            });
            samplers.push({
                handleKey: samplerHandleKey,
                textureIndex: textureSlot.textureIndex,
                slot: textureSlot.slot,
                source: samplerSourceForTexture(options.root, textureSlot.textureIndex),
                sampler: report.sampler,
            });
            diagnostics.push(...report.diagnostics.map((diagnostic) => textureDiagnosticToAssetDiagnostic(diagnostic)));
        }
        const materialReport = createMaterialAssetFromGltfMaterial(material, {
            materialKey,
            extensionsRequired,
            resolveTextureBinding: resolverFromTextureEntries(textureEntries),
        });
        plannedMaterials.push({
            handleKey: assetHandleKey(createMaterialHandle(materialKey)),
            materialIndex,
            material: materialReport.material,
            report: gltfMaterialMappingReportToJsonValue(materialReport),
        });
        diagnostics.push(...materialReport.diagnostics.map((diagnostic) => ({
            layer: "material",
            code: diagnostic.code,
            severity: diagnostic.severity,
            message: diagnostic.message,
            materialIndex,
            ...(diagnostic.textureIndex === undefined
                ? {}
                : { textureIndex: diagnostic.textureIndex }),
            ...(diagnostic.samplerIndex === undefined
                ? {}
                : { samplerIndex: diagnostic.samplerIndex }),
            ...(diagnostic.slot === undefined ? {} : { slot: diagnostic.slot }),
            ...(diagnostic.field === undefined ? {} : { field: diagnostic.field }),
            ...(diagnostic.extensionName === undefined
                ? {}
                : { extensionName: diagnostic.extensionName }),
            ...(diagnostic.dependencyKind === undefined
                ? {}
                : { dependencyKind: diagnostic.dependencyKind }),
            ...(diagnostic.value === undefined ? {} : { value: diagnostic.value }),
        })));
    }
    return {
        valid: diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
        root,
        textures,
        samplers,
        materials: plannedMaterials,
        diagnostics,
    };
}
function resolverFromTextureEntries(entries) {
    return (input) => {
        const entry = entries.get(textureReportKey(input.textureIndex, input.slot));
        if (entry !== undefined &&
            entry.report.valid &&
            entry.report.texture !== null &&
            entry.report.sampler !== null) {
            return {
                texture: createTextureHandle(entry.textureHandleKey),
                sampler: createSamplerHandle(entry.samplerHandleKey),
            };
        }
        return {
            diagnostics: (entry?.report.diagnostics ?? []).map((diagnostic) => textureDiagnosticToResolverDiagnostic(diagnostic)),
        };
    };
}
//# sourceMappingURL=gltf-asset-mapping.js.map