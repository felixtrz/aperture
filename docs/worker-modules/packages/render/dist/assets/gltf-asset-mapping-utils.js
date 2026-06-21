export function textureDiagnosticToResolverDiagnostic(diagnostic) {
    const samplerFailure = diagnostic.code === "gltfTexture.invalidSamplerIndex" ||
        diagnostic.code === "gltfTexture.invalidSampler";
    return {
        dependencyKind: samplerFailure ? "sampler" : "texture",
        message: diagnostic.message,
        ...(diagnostic.samplerIndex === undefined
            ? {}
            : { samplerIndex: diagnostic.samplerIndex }),
    };
}
export function textureDiagnosticToAssetDiagnostic(diagnostic) {
    return {
        layer: "texture",
        code: diagnostic.code,
        severity: diagnostic.severity,
        message: diagnostic.message,
        textureIndex: diagnostic.textureIndex,
        slot: diagnostic.slot,
        ...(diagnostic.samplerIndex === undefined
            ? {}
            : { samplerIndex: diagnostic.samplerIndex }),
        ...(diagnostic.field === undefined ? {} : { field: diagnostic.field }),
        ...(diagnostic.value === undefined ? {} : { value: diagnostic.value }),
    };
}
export function collectMaterialTextureSlots(material) {
    if (!isRecord(material)) {
        return [];
    }
    const pbr = recordField(material, "pbrMetallicRoughness");
    const clearcoat = recordField(recordField(material, "extensions") ?? {}, "KHR_materials_clearcoat");
    const transmission = recordField(recordField(material, "extensions") ?? {}, "KHR_materials_transmission");
    const sheen = recordField(recordField(material, "extensions") ?? {}, "KHR_materials_sheen");
    const iridescence = recordField(recordField(material, "extensions") ?? {}, "KHR_materials_iridescence");
    return [
        textureSlot(pbr?.baseColorTexture, "baseColorTexture"),
        textureSlot(pbr?.metallicRoughnessTexture, "metallicRoughnessTexture"),
        textureSlot(clearcoat?.clearcoatTexture, "clearcoatTexture"),
        textureSlot(clearcoat?.clearcoatRoughnessTexture, "clearcoatRoughnessTexture"),
        textureSlot(transmission?.transmissionTexture, "transmissionTexture"),
        textureSlot(sheen?.sheenColorTexture, "sheenColorTexture"),
        textureSlot(sheen?.sheenRoughnessTexture, "sheenRoughnessTexture"),
        textureSlot(iridescence?.iridescenceTexture, "iridescenceTexture"),
        textureSlot(iridescence?.iridescenceThicknessTexture, "iridescenceThicknessTexture"),
        textureSlot(material.normalTexture, "normalTexture"),
        textureSlot(material.occlusionTexture, "occlusionTexture"),
        textureSlot(material.emissiveTexture, "emissiveTexture"),
    ].filter((slot) => slot !== null);
}
export function textureReportKey(textureIndex, slot) {
    return `${textureIndex}:${slot}`;
}
export function plannedHandleKey(options, kind, index, slot) {
    const prefix = options.keyPrefix ?? "gltf";
    return slot === undefined
        ? `${prefix}:${kind}:${index}`
        : `${prefix}:${kind}:${index}:${slot}`;
}
export function samplerSourceForTexture(root, textureIndex) {
    const texture = arrayField(root, "textures")[textureIndex];
    if (!isRecord(texture) || typeof texture.sampler !== "number") {
        return null;
    }
    const sampler = arrayField(root, "samplers")[texture.sampler];
    return isRecord(sampler) ? sampler : null;
}
export function arrayField(root, field) {
    const value = root[field];
    return Array.isArray(value) ? value : [];
}
export function stringArray(value) {
    return Array.isArray(value)
        ? value.filter((item) => typeof item === "string")
        : [];
}
export function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function textureSlot(textureInfo, slot) {
    if (!isRecord(textureInfo) || !Number.isInteger(textureInfo.index)) {
        return null;
    }
    const textureIndex = textureInfo.index;
    return typeof textureIndex === "number" && textureIndex >= 0
        ? { slot, textureIndex }
        : null;
}
function recordField(source, field) {
    const value = source[field];
    return isRecord(value) ? value : undefined;
}
//# sourceMappingURL=gltf-asset-mapping-utils.js.map