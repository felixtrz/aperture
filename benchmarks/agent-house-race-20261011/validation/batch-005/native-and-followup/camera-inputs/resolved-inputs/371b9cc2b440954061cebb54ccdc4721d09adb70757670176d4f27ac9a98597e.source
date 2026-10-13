import { isNonNegativeInteger, mimeTypeFromUri, recordField, toDiagnosticValue, } from "./gltf-texture-utils.js";
const SUPPORTED_IMAGE_MIME_TYPES = new Set([
    "image/png",
    "image/jpeg",
    "image/ktx2",
]);
const UNSUPPORTED_TEXTURE_EXTENSIONS = new Set([
    "EXT_texture_webp",
    "EXT_texture_avif",
]);
export function mapImageIndex(input) {
    const basisuSource = textureBasisuSource(input.texture);
    if (basisuSource !== undefined) {
        if (isNonNegativeInteger(basisuSource)) {
            return basisuSource;
        }
        input.diagnostics.push({
            code: "gltfTexture.invalidTextureSource",
            severity: "error",
            textureIndex: input.textureIndex,
            slot: input.slot,
            field: `textures[${input.textureIndex}].extensions.KHR_texture_basisu.source`,
            value: toDiagnosticValue(basisuSource),
            message: `textures[${input.textureIndex}].extensions.KHR_texture_basisu.source must be a non-negative image index.`,
        });
        return null;
    }
    if (isNonNegativeInteger(input.texture.source)) {
        return input.texture.source;
    }
    input.diagnostics.push({
        code: "gltfTexture.invalidTextureSource",
        severity: "error",
        textureIndex: input.textureIndex,
        slot: input.slot,
        field: `textures[${input.textureIndex}].source`,
        value: toDiagnosticValue(input.texture.source),
        message: `textures[${input.textureIndex}].source must be a non-negative image index.`,
    });
    return null;
}
export function inspectTextureExtensions(input) {
    const extensions = recordField(input.texture, "extensions");
    if (extensions === undefined) {
        return;
    }
    const required = new Set(input.required);
    for (const extensionName of Object.keys(extensions)) {
        if (!UNSUPPORTED_TEXTURE_EXTENSIONS.has(extensionName)) {
            continue;
        }
        const requiredExtension = required.has(extensionName);
        input.diagnostics.push({
            code: requiredExtension
                ? "gltfTexture.unsupportedRequiredTextureExtension"
                : "gltfTexture.unsupportedTextureExtension",
            severity: requiredExtension ? "error" : "warning",
            textureIndex: input.textureIndex,
            slot: input.slot,
            extensionName,
            field: `textures[${input.textureIndex}].extensions.${extensionName}`,
            message: requiredExtension
                ? `Required glTF texture extension '${extensionName}' is not supported.`
                : `Optional glTF texture extension '${extensionName}' is not supported by the minimal mapper.`,
        });
    }
}
export function mapImageSource(input) {
    if (isNonNegativeInteger(input.image.bufferView)) {
        if (typeof input.image.mimeType !== "string") {
            input.diagnostics.push({
                code: "gltfTexture.missingImageSource",
                severity: "error",
                textureIndex: input.textureIndex,
                slot: input.slot,
                imageIndex: input.imageIndex,
                field: `images[${input.imageIndex}].mimeType`,
                value: toDiagnosticValue(input.image.mimeType),
                message: "BufferView images must declare a MIME type.",
            });
            return null;
        }
        if (!SUPPORTED_IMAGE_MIME_TYPES.has(input.image.mimeType)) {
            pushUnsupportedMimeType(input, input.image.mimeType);
            return null;
        }
        return {
            kind: "bufferView",
            bufferView: input.image.bufferView,
            mimeType: input.image.mimeType,
        };
    }
    if (typeof input.image.uri === "string") {
        const mimeType = typeof input.image.mimeType === "string"
            ? input.image.mimeType
            : mimeTypeFromUri(input.image.uri);
        if (mimeType !== undefined && !SUPPORTED_IMAGE_MIME_TYPES.has(mimeType)) {
            pushUnsupportedMimeType(input, mimeType);
            return null;
        }
        return {
            kind: "uri",
            uri: input.image.uri,
            ...(mimeType === undefined ? {} : { mimeType }),
        };
    }
    input.diagnostics.push({
        code: "gltfTexture.missingImageSource",
        severity: "error",
        textureIndex: input.textureIndex,
        slot: input.slot,
        imageIndex: input.imageIndex,
        field: `images[${input.imageIndex}]`,
        message: `images[${input.imageIndex}] must provide a URI or bufferView source.`,
    });
    return null;
}
function textureBasisuSource(texture) {
    const extensions = recordField(texture, "extensions");
    if (extensions === undefined) {
        return undefined;
    }
    return recordField(extensions, "KHR_texture_basisu")?.source;
}
function pushUnsupportedMimeType(input, mimeType) {
    input.diagnostics.push({
        code: "gltfTexture.unsupportedImageMimeType",
        severity: "error",
        textureIndex: input.textureIndex,
        slot: input.slot,
        imageIndex: input.imageIndex,
        field: `images[${input.imageIndex}].mimeType`,
        value: mimeType,
        message: `Image MIME type '${mimeType}' is not supported by the minimal mapper.`,
    });
}
//# sourceMappingURL=gltf-texture-source-mapping.js.map