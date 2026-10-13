import { createTextureAsset } from "./factories.js";
export function preparedReport(report) {
    return { kind: "report", report };
}
export function createTextureMappingReportFromDecoded(input) {
    if (input.decoded === null) {
        return createGltfTextureMappingReport({
            options: input.options,
            diagnostics: input.diagnostics,
            texture: null,
            sampler: input.sampler,
            imageIndex: input.imageIndex,
            samplerIndex: input.samplerIndex,
        });
    }
    const slotInfo = textureSlotInfo(input.options.slot);
    const format = input.decoded.format ?? slotInfo.format;
    const textureAsset = createTextureAsset({
        label: textureLabel(input.options, input.texture, input.image),
        dimension: "2d",
        width: input.decoded.width,
        height: input.decoded.height,
        format,
        colorSpace: slotInfo.colorSpace,
        semantic: slotInfo.semantic,
        mipLevelCount: decodedMipLevelCount({
            decoded: input.decoded,
            format,
            sampler: input.sampler,
        }),
        usage: ["sampled", "copy-dst"],
        sourceData: input.decoded.sourceData,
    });
    return createGltfTextureMappingReport({
        options: input.options,
        diagnostics: input.diagnostics,
        texture: textureAsset,
        sampler: input.sampler,
        imageIndex: input.imageIndex,
        samplerIndex: input.samplerIndex,
    });
}
export function createGltfTextureMappingReport(input) {
    return {
        valid: input.diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
        texture: input.texture,
        sampler: input.sampler,
        textureIndex: input.options.textureIndex,
        slot: input.options.slot,
        ...(input.imageIndex === undefined ? {} : { imageIndex: input.imageIndex }),
        ...(input.samplerIndex === undefined
            ? {}
            : { samplerIndex: input.samplerIndex }),
        diagnostics: input.diagnostics,
    };
}
function decodedMipLevelCount(input) {
    const sourceMipLevelCount = input.decoded.sourceData.mipLevels?.length ?? 0;
    if (sourceMipLevelCount > 1) {
        return sourceMipLevelCount;
    }
    if (input.sampler !== null &&
        input.sampler.mipmapFilter !== "nearest" &&
        canGenerateTextureMipmapsForFormat(input.format)) {
        return fullMipLevelCount(input.decoded.width, input.decoded.height);
    }
    return 1;
}
function fullMipLevelCount(width, height) {
    return Math.floor(Math.log2(Math.max(width, height))) + 1;
}
function canGenerateTextureMipmapsForFormat(format) {
    return (!format.startsWith("bc") &&
        !format.startsWith("etc2-") &&
        !format.startsWith("astc-"));
}
function textureSlotInfo(slot) {
    switch (slot) {
        case "baseColorTexture":
            return {
                semantic: "base-color",
                colorSpace: "srgb",
                format: "rgba8unorm-srgb",
            };
        case "emissiveTexture":
            return {
                semantic: "emissive",
                colorSpace: "srgb",
                format: "rgba8unorm-srgb",
            };
        case "sheenColorTexture":
            return {
                semantic: "sheen-color",
                colorSpace: "srgb",
                format: "rgba8unorm-srgb",
            };
        case "sheenRoughnessTexture":
            return {
                semantic: "sheen-roughness",
                colorSpace: "data",
                format: "rgba8unorm",
            };
        case "iridescenceTexture":
            return {
                semantic: "iridescence",
                colorSpace: "data",
                format: "rgba8unorm",
            };
        case "iridescenceThicknessTexture":
            return {
                semantic: "iridescence-thickness",
                colorSpace: "data",
                format: "rgba8unorm",
            };
        case "clearcoatRoughnessTexture":
            return {
                semantic: "clearcoat-roughness",
                colorSpace: "data",
                format: "rgba8unorm",
            };
        case "metallicRoughnessTexture":
            return {
                semantic: "metallic-roughness",
                colorSpace: "data",
                format: "rgba8unorm",
            };
        case "clearcoatTexture":
        case "transmissionTexture":
            return { semantic: "data", colorSpace: "data", format: "rgba8unorm" };
        case "normalTexture":
            return { semantic: "normal", colorSpace: "data", format: "rgba8unorm" };
        case "occlusionTexture":
            return {
                semantic: "occlusion",
                colorSpace: "data",
                format: "rgba8unorm",
            };
    }
}
function textureLabel(options, texture, image) {
    if (options.label !== undefined) {
        return options.label;
    }
    if (typeof texture.name === "string" && texture.name.length > 0) {
        return texture.name;
    }
    if (typeof image.name === "string" && image.name.length > 0) {
        return image.name;
    }
    return `glTF Texture ${options.textureIndex} ${options.slot}`;
}
//# sourceMappingURL=gltf-texture-result.js.map