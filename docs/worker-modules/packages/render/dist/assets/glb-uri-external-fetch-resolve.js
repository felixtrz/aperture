import { fetchIndexFields } from "./glb-uri-fetch-bytes.js";
export function resolveSameOriginBufferUrl(input) {
    if (input.uri.startsWith("data:")) {
        return {
            ok: false,
            diagnostic: {
                code: "loadGlbFromUri.unsupportedBufferUri",
                severity: "error",
                uri: input.uri,
                bufferIndex: input.bufferIndex,
                message: `GLB external buffer ${input.bufferIndex} uses an embedded data URI, which must be provided via externalBufferBytes.`,
            },
        };
    }
    return resolveSameOriginUrl({
        sourceUrl: input.sourceUrl,
        uri: input.uri,
        code: "loadGlbFromUri.unsupportedBufferUri",
        message: `GLB external buffer ${input.bufferIndex} URI '${input.uri}' is not same-origin with the source GLB.`,
        bufferIndex: input.bufferIndex,
    });
}
export function resolveSameOriginImageUrl(input) {
    const uri = input.image.uri;
    if (typeof uri !== "string") {
        return {
            ok: false,
            diagnostic: {
                code: "loadGlbFromUri.unsupportedImageUri",
                severity: "error",
                imageIndex: input.imageIndex,
                message: `GLB image ${input.imageIndex} does not provide a URI.`,
            },
        };
    }
    return resolveSameOriginUrl({
        sourceUrl: input.sourceUrl,
        uri,
        code: "loadGlbFromUri.unsupportedImageUri",
        message: `GLB image ${input.imageIndex} URI '${uri}' is not same-origin with the source GLB.`,
        imageIndex: input.imageIndex,
    });
}
function resolveSameOriginUrl(input) {
    let url;
    try {
        url = new URL(input.uri, input.sourceUrl);
    }
    catch {
        return {
            ok: false,
            diagnostic: {
                code: input.code,
                severity: "error",
                uri: input.uri,
                ...fetchIndexFields(input),
                message: `GLB URI '${input.uri}' could not be resolved.`,
            },
        };
    }
    if (url.origin !== input.sourceUrl.origin) {
        return {
            ok: false,
            diagnostic: {
                code: input.code,
                severity: "error",
                uri: input.uri,
                ...fetchIndexFields(input),
                message: input.message,
            },
        };
    }
    return { ok: true, url: url.href };
}
export function isRecord(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}
//# sourceMappingURL=glb-uri-external-fetch-resolve.js.map