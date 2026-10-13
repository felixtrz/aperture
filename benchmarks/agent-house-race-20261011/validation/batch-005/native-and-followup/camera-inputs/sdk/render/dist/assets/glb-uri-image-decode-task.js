import { loadGltfTextureAsync } from "../materials/gltf-texture-loading.js";
import { imageDecodeCacheKey, imageDecodeOptionsKeyField, resolveBasisKtx2Transcoder, } from "./glb-uri-image-cache.js";
import { byteLengthOf, bytesForImageSource } from "./glb-uri-image-bytes.js";
import { externalImageSourceKind, imageSourceRefFromImage, imageStatusUri, isRecord, } from "./glb-uri-image-sources.js";
export async function decodeGlbExternalImage(input) {
    if (!isRecord(input.image)) {
        return null;
    }
    const source = imageSourceRefFromImage(input.image);
    if (!source.ok) {
        if (typeof input.image.uri === "string" ||
            Number.isInteger(input.image.bufferView)) {
            return {
                diagnostics: [
                    {
                        code: "loadGlbFromUri.unsupportedImageUri",
                        severity: "error",
                        imageIndex: input.imageIndex,
                        ...(typeof input.image.uri === "string"
                            ? { uri: input.image.uri }
                            : {}),
                        message: source.message,
                    },
                ],
                statuses: [],
            };
        }
        return null;
    }
    const imageBytes = bytesForImageSource({
        root: input.root,
        binary: input.binary,
        source: source.source,
        imageIndex: input.imageIndex,
        externalBufferBytes: input.externalBufferBytes,
        externalImageBytes: input.externalImageBytes,
    });
    if (!imageBytes.ok) {
        return {
            diagnostics: [imageBytes.diagnostic],
            statuses: [
                {
                    imageIndex: input.imageIndex,
                    sourceKind: externalImageSourceKind(source.source),
                    uri: imageStatusUri(source.source),
                    status: "blocked",
                    byteLength: null,
                    ...(source.source.mimeType === undefined
                        ? {}
                        : { mimeType: source.source.mimeType }),
                    ...(imageBytes.diagnostic.uri === undefined
                        ? {}
                        : { url: imageBytes.diagnostic.uri }),
                    diagnosticCode: imageBytes.diagnostic.code,
                },
            ],
        };
    }
    try {
        const decodeCacheKey = imageDecodeCacheKey({
            source: source.source,
            sourceUrl: input.sourceUrl,
            bytes: imageBytes.bytes,
            byteObjectId: input.byteObjectId,
            ...imageDecodeOptionsKeyField({
                source: source.source,
                ...(input.ktx2TextureCompression === undefined
                    ? {}
                    : { textureCompression: input.ktx2TextureCompression }),
            }),
        });
        let decodedPromise = input.decodeCache.get(decodeCacheKey);
        if (decodedPromise === undefined) {
            const basisTranscoder = input.decodeImageData === undefined
                ? await resolveBasisKtx2Transcoder({
                    source: source.source,
                    provided: input.basisTranscoder,
                    create: input.createBasisKtx2Transcoder,
                    getCreated: input.getCreatedBasisTranscoder,
                    setCreated: input.setCreatedBasisTranscoder,
                })
                : undefined;
            decodedPromise = loadGltfTextureAsync({
                source: source.source,
                ...(imageBytes.bytes === undefined ? {} : { bytes: imageBytes.bytes }),
                ...(input.decodeImageData === undefined
                    ? {}
                    : { decodeImageData: input.decodeImageData }),
                ...(basisTranscoder === undefined ? {} : { basisTranscoder }),
                ...(input.ktx2TextureCompression === undefined
                    ? {}
                    : { ktx2TextureCompression: input.ktx2TextureCompression }),
            }).catch((error) => {
                input.decodeCache.delete(decodeCacheKey);
                throw error;
            });
            input.decodeCache.set(decodeCacheKey, decodedPromise);
        }
        const decoded = await decodedPromise;
        return {
            decoded: { imageIndex: input.imageIndex, image: decoded },
            diagnostics: [],
            statuses: [
                {
                    imageIndex: input.imageIndex,
                    sourceKind: externalImageSourceKind(source.source),
                    uri: imageStatusUri(source.source),
                    status: "loaded",
                    byteLength: imageBytes.bytes === undefined
                        ? decoded.sourceData.bytes.byteLength
                        : byteLengthOf(imageBytes.bytes),
                    ...(source.source.mimeType === undefined
                        ? {}
                        : { mimeType: source.source.mimeType }),
                    ...(source.source.kind === "uri" &&
                        !source.source.uri.startsWith("data:")
                        ? { url: new URL(source.source.uri, input.sourceUrl).href }
                        : {}),
                    width: decoded.width,
                    height: decoded.height,
                },
            ],
        };
    }
    catch (error) {
        const uri = imageStatusUri(source.source);
        return {
            diagnostics: [
                {
                    code: "loadGlbFromUri.imageReadFailed",
                    severity: "error",
                    imageIndex: input.imageIndex,
                    uri,
                    message: errorMessage(error, `Decoding GLB image ${input.imageIndex} '${uri}' failed.`),
                },
            ],
            statuses: [
                {
                    imageIndex: input.imageIndex,
                    sourceKind: externalImageSourceKind(source.source),
                    uri,
                    status: "blocked",
                    byteLength: imageBytes.bytes === undefined
                        ? null
                        : byteLengthOf(imageBytes.bytes),
                    ...(source.source.mimeType === undefined
                        ? {}
                        : { mimeType: source.source.mimeType }),
                    diagnosticCode: "loadGlbFromUri.imageReadFailed",
                },
            ],
        };
    }
}
function errorMessage(error, fallback) {
    return error instanceof Error ? error.message : fallback;
}
//# sourceMappingURL=glb-uri-image-decode-task.js.map