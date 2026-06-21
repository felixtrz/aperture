export function mimeTypeFromImage(image, uri) {
    const mimeType = typeof image.mimeType === "string" ? image.mimeType : mimeTypeFromUri(uri);
    return mimeType !== null && isSupportedImageMimeType(mimeType)
        ? mimeType
        : null;
}
function mimeTypeFromUri(uri) {
    const dataPrefix = uri.match(/^data:([^;,]+)[;,]/u);
    if (dataPrefix?.[1] !== undefined) {
        return dataPrefix[1];
    }
    let pathname;
    try {
        pathname = new URL(uri, "https://example.invalid/").pathname;
    }
    catch {
        pathname = uri;
    }
    const lower = pathname.toLowerCase();
    if (lower.endsWith(".png")) {
        return "image/png";
    }
    if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
        return "image/jpeg";
    }
    if (lower.endsWith(".ktx2")) {
        return "image/ktx2";
    }
    return null;
}
export function isSupportedImageMimeType(mimeType) {
    return (mimeType === "image/png" ||
        mimeType === "image/jpeg" ||
        mimeType === "image/ktx2");
}
export function bytesView(bytes) {
    return bytes instanceof ArrayBuffer
        ? new Uint8Array(bytes)
        : new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}
export function normalizeUrl(url) {
    try {
        return new URL(url).href;
    }
    catch {
        return null;
    }
}
export function errorMessage(error, fallback) {
    return error instanceof Error ? error.message : fallback;
}
export function isRecord(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}
//# sourceMappingURL=gltf-uri-shared.js.map