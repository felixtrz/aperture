import { decodeKtx2TextureDataAsync } from "../assets/ktx2-decoder.js";
import { decodeImageBytesWithBrowserCanvas } from "./gltf-texture-browser-decoder.js";
import { loadGltfImageBytes, mimeTypeFromImageSource, } from "./gltf-texture-image-bytes.js";
import { validDecodedImage } from "./gltf-texture-utils.js";
export async function loadGltfTextureAsync(source) {
    const bytes = await loadGltfImageBytes(source);
    const mimeType = mimeTypeFromImageSource(source.source);
    if (mimeType === "image/ktx2" && source.decodeImageData === undefined) {
        const image = await decodeKtx2TextureDataAsync(bytes, {
            ...(source.basisTranscoder === undefined
                ? {}
                : { basisTranscoder: source.basisTranscoder }),
            ...(source.ktx2TextureCompression === undefined
                ? {}
                : { textureCompression: source.ktx2TextureCompression }),
        });
        if (!validDecodedImage(image)) {
            throw new Error("Decoded glTF image data must include positive dimensions, row stride, and Uint8Array bytes.");
        }
        return image;
    }
    const decoder = source.decodeImageData ?? decodeImageBytesWithBrowserCanvas;
    const image = await decoder({
        source: source.source,
        bytes,
        ...(mimeType === undefined ? {} : { mimeType }),
    });
    if (!validDecodedImage(image)) {
        throw new Error("Decoded glTF image data must include positive dimensions, row stride, and Uint8Array bytes.");
    }
    return image;
}
//# sourceMappingURL=gltf-texture-loading.js.map