import { bytesView, isRecord, mimeTypeFromUri } from "./gltf-texture-utils.js";
export async function loadGltfImageBytes(input) {
    if (input.bytes !== undefined) {
        return bytesView(input.bytes);
    }
    if (input.source.kind === "uri") {
        if (input.source.uri.startsWith("data:")) {
            return decodeDataUriBytes(input.source.uri);
        }
        return fetchGltfImageBytes(input);
    }
    throw new Error(`glTF bufferView image ${input.source.bufferView} requires bytes before async decode.`);
}
export function mimeTypeFromImageSource(source) {
    return source.kind === "bufferView"
        ? source.mimeType
        : (source.mimeType ?? mimeTypeFromUri(source.uri));
}
async function fetchGltfImageBytes(input) {
    if (input.source.kind !== "uri") {
        throw new Error("Only glTF URI image sources can be fetched.");
    }
    const mimeType = mimeTypeFromImageSource(input.source);
    const fetchResult = input.fetchImageBytes === undefined
        ? await fetchUriImageBytes(input.source.uri)
        : await input.fetchImageBytes({
            uri: input.source.uri,
            source: input.source,
            ...(mimeType === undefined ? {} : { mimeType }),
        });
    return bytesFromFetchResult(fetchResult);
}
async function fetchUriImageBytes(uri) {
    if (typeof fetch !== "function") {
        throw new Error("No fetch implementation is available for glTF URI image loading.");
    }
    const response = await fetch(uri);
    if (!response.ok) {
        throw new Error(`Fetching glTF image URI '${uri}' failed with HTTP ${response.status}.`);
    }
    return response;
}
async function bytesFromFetchResult(resultValue) {
    if (isResponseLike(resultValue)) {
        if (!resultValue.ok) {
            throw new Error(`Fetching glTF image failed with HTTP ${resultValue.status}.`);
        }
        return new Uint8Array(await resultValue.arrayBuffer());
    }
    if (isBlobLike(resultValue)) {
        return new Uint8Array(await resultValue.arrayBuffer());
    }
    return bytesView(resultValue);
}
function decodeDataUriBytes(uri) {
    const match = /^data:([^,]*),(.*)$/u.exec(uri);
    if (match === null) {
        throw new Error("Malformed glTF data URI image source.");
    }
    const metadata = match[1] ?? "";
    const payload = match[2] ?? "";
    if (metadata.split(";").includes("base64")) {
        if (typeof atob !== "function") {
            throw new Error("No base64 decoder is available for glTF data URI image.");
        }
        const binary = atob(decodeURIComponent(payload));
        const bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index += 1) {
            bytes[index] = binary.charCodeAt(index);
        }
        return bytes;
    }
    const text = decodeURIComponent(payload);
    const bytes = new Uint8Array(text.length);
    for (let index = 0; index < text.length; index += 1) {
        bytes[index] = text.charCodeAt(index) & 0xff;
    }
    return bytes;
}
function isResponseLike(value) {
    return (isRecord(value) &&
        typeof value.arrayBuffer === "function" &&
        typeof value.ok === "boolean");
}
function isBlobLike(value) {
    return (isRecord(value) &&
        typeof value.arrayBuffer === "function" &&
        typeof value.size === "number");
}
//# sourceMappingURL=gltf-texture-image-bytes.js.map