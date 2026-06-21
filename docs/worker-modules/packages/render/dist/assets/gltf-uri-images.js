import { decodeGltfExternalImage } from "./gltf-uri-image-decode-task.js";
import { mapWithConcurrency } from "./gltf-uri-image-merge.js";
export { createMergedImageDataResolver, normalizeConcurrency, } from "./gltf-uri-image-merge.js";
export async function decodeExternalImages(input) {
    const images = Array.isArray(input.root.images) ? input.root.images : [];
    const sourceUrl = new URL(input.sourceUrl);
    const decodedImages = new Map();
    const statuses = [];
    const diagnostics = [];
    const decodeCache = input.cache?.decodedImages ??
        new Map();
    const byteObjectIds = new WeakMap();
    let nextByteObjectId = 0;
    let createdBasisTranscoder = null;
    const byteObjectId = (bytes) => {
        const object = bytes;
        const existing = byteObjectIds.get(object);
        if (existing !== undefined) {
            return existing;
        }
        const id = nextByteObjectId;
        nextByteObjectId += 1;
        byteObjectIds.set(object, id);
        return id;
    };
    const results = await mapWithConcurrency(images.map((image, imageIndex) => ({ image, imageIndex })), input.imageDecodeConcurrency, ({ image, imageIndex }) => decodeGltfExternalImage({
        image,
        imageIndex,
        root: input.root,
        sourceUrl,
        externalBufferBytes: input.externalBufferBytes,
        externalImageBytes: input.externalImageBytes,
        ...(input.decodeImageData === undefined
            ? {}
            : { decodeImageData: input.decodeImageData }),
        ...(input.basisTranscoder === undefined
            ? {}
            : { basisTranscoder: input.basisTranscoder }),
        ...(input.createBasisKtx2Transcoder === undefined
            ? {}
            : { createBasisKtx2Transcoder: input.createBasisKtx2Transcoder }),
        ...(input.ktx2TextureCompression === undefined
            ? {}
            : { ktx2TextureCompression: input.ktx2TextureCompression }),
        decodeCache,
        byteObjectId,
        getCreatedBasisTranscoder: () => createdBasisTranscoder,
        setCreatedBasisTranscoder: (promise) => {
            createdBasisTranscoder = promise;
        },
    }));
    for (const result of results) {
        if (result === null) {
            continue;
        }
        if (result.decoded !== undefined) {
            decodedImages.set(result.decoded.imageIndex, result.decoded.image);
        }
        diagnostics.push(...result.diagnostics);
        statuses.push(...result.statuses);
    }
    return { images: decodedImages, statuses, diagnostics };
}
//# sourceMappingURL=gltf-uri-images.js.map