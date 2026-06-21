import { fetchDeduplicatedExternalBytes } from "./gltf-uri-external-fetch-dedupe.js";
import { resolveSameOriginBufferUrl, resolveSameOriginImageUrl, } from "./gltf-uri-external-fetch-resolve.js";
import { isRecord } from "./gltf-uri-shared.js";
export async function fetchExternalBuffers(input) {
    const buffers = Array.isArray(input.root.buffers) ? input.root.buffers : [];
    const sourceUrl = new URL(input.sourceUrl);
    const bytes = new Map();
    const diagnostics = [];
    const candidates = [];
    buffers.forEach((buffer, bufferIndex) => {
        if (!isRecord(buffer) || typeof buffer.uri !== "string") {
            return;
        }
        const bufferUrl = resolveSameOriginBufferUrl({
            sourceUrl,
            uri: buffer.uri,
            bufferIndex,
        });
        if (!bufferUrl.ok) {
            diagnostics.push(bufferUrl.diagnostic);
            return;
        }
        candidates.push({ index: bufferIndex, url: bufferUrl.url });
    });
    const results = await fetchDeduplicatedExternalBytes({
        candidates,
        fetcher: input.fetcher,
        context: "buffer",
        ...(input.cache === undefined ? {} : { cache: input.cache }),
    });
    for (const result of results) {
        if ("diagnostic" in result) {
            diagnostics.push(result.diagnostic);
        }
        else {
            bytes.set(result.index, result.bytes);
        }
    }
    return { bytes, diagnostics };
}
export async function fetchExternalImages(input) {
    const images = Array.isArray(input.root.images) ? input.root.images : [];
    const sourceUrl = new URL(input.sourceUrl);
    const bytes = new Map();
    const diagnostics = [];
    const candidates = [];
    images.forEach((image, imageIndex) => {
        if (!isRecord(image) || typeof image.uri !== "string") {
            return;
        }
        if (image.uri.startsWith("data:")) {
            return;
        }
        const imageUrl = resolveSameOriginImageUrl({
            sourceUrl,
            image,
            imageIndex,
        });
        if (!imageUrl.ok) {
            diagnostics.push(imageUrl.diagnostic);
            return;
        }
        if (input.provided?.has(imageIndex) === true) {
            return;
        }
        candidates.push({ index: imageIndex, url: imageUrl.url });
    });
    const results = await fetchDeduplicatedExternalBytes({
        candidates,
        fetcher: input.fetcher,
        context: "image",
        ...(input.cache === undefined ? {} : { cache: input.cache }),
    });
    for (const result of results) {
        if ("diagnostic" in result) {
            diagnostics.push(result.diagnostic);
        }
        else {
            bytes.set(result.index, result.bytes);
        }
    }
    return { bytes, diagnostics };
}
//# sourceMappingURL=gltf-uri-external-fetch.js.map