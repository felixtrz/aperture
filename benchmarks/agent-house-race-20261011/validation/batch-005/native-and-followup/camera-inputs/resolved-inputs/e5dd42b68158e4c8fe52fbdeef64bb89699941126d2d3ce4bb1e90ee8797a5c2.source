import { createNoFetchGltfSourceLoaderReport } from "./gltf-source-loader-facade.js";
import { createMergedImageDataResolver, decodeExternalImages, normalizeConcurrency, } from "./gltf-uri-images.js";
import { fetchBytes, fetchExternalBuffers, fetchExternalImages, mergeExternalBufferBytes, mergeExternalImageBytes, parseGltfJson, } from "./gltf-uri-fetch.js";
import { normalizeUrl } from "./gltf-uri-shared.js";
export function createGltfUriLoadCache() {
    return {
        bytes: new Map(),
        decodedImages: new Map(),
    };
}
export async function loadGltfFromUri(url, options = {}) {
    const normalizedUrl = normalizeUrl(url);
    if (normalizedUrl === null) {
        return failure(url, {
            code: "loadGltfFromUri.invalidUrl",
            severity: "error",
            message: `glTF URI '${url}' is not a valid absolute URL.`,
        });
    }
    const fetcher = options.fetch ??
        (globalThis.fetch === undefined
            ? undefined
            : (requestUrl) => globalThis.fetch(requestUrl));
    if (fetcher === undefined) {
        return failure(normalizedUrl, {
            code: "loadGltfFromUri.fetchUnavailable",
            severity: "error",
            message: "glTF URI loading requires globalThis.fetch or an explicit fetch option.",
        });
    }
    const source = await fetchBytes({
        url: normalizedUrl,
        fetcher,
        context: "source",
        ...(options.cache === undefined ? {} : { cache: options.cache }),
    });
    if (!source.ok) {
        return failure(normalizedUrl, source.diagnostic);
    }
    const parsed = parseGltfJson(normalizedUrl, source.bytes);
    if (!parsed.ok) {
        return failure(normalizedUrl, parsed.diagnostic, source.bytes.byteLength);
    }
    const [externalBuffers, externalImages] = await Promise.all([
        fetchExternalBuffers({
            root: parsed.root,
            sourceUrl: normalizedUrl,
            fetcher,
            ...(options.cache === undefined ? {} : { cache: options.cache }),
        }),
        fetchExternalImages({
            root: parsed.root,
            sourceUrl: normalizedUrl,
            fetcher,
            provided: options.externalImageBytes,
            ...(options.cache === undefined ? {} : { cache: options.cache }),
        }),
    ]);
    const { fetch: _fetch, cache: _cache, decodeImageData, basisTranscoder, createBasisKtx2Transcoder, ktx2TextureCompression, imageDecodeConcurrency, externalBufferBytes: providedBuffers, externalImageBytes: providedImages, resolveImageData, ...loaderOptions } = options;
    const mergedExternalBuffers = mergeExternalBufferBytes(providedBuffers, externalBuffers.bytes);
    const mergedExternalImages = mergeExternalImageBytes(providedImages, externalImages.bytes);
    const decodedImages = await decodeExternalImages({
        root: parsed.root,
        sourceUrl: normalizedUrl,
        externalBufferBytes: mergedExternalBuffers,
        externalImageBytes: mergedExternalImages,
        ...(decodeImageData === undefined ? {} : { decodeImageData }),
        ...(basisTranscoder === undefined ? {} : { basisTranscoder }),
        ...(createBasisKtx2Transcoder === undefined
            ? {}
            : { createBasisKtx2Transcoder }),
        ...(ktx2TextureCompression === undefined ? {} : { ktx2TextureCompression }),
        imageDecodeConcurrency: normalizeConcurrency(imageDecodeConcurrency, 4),
        ...(options.cache === undefined ? {} : { cache: options.cache }),
    });
    const loader = createNoFetchGltfSourceLoaderReport({
        ...loaderOptions,
        root: parsed.root,
        sourceByteLength: source.bytes.byteLength,
        externalBufferBytes: mergedExternalBuffers,
        externalImageBytes: mergedExternalImages,
        decodedImageData: decodedImages.images,
        resolveImageData: createMergedImageDataResolver({
            decodedImages: decodedImages.images,
            fallback: resolveImageData,
        }),
    });
    const loaderDiagnostics = loader.status.diagnostics.map((diagnostic) => ({
        code: "loadGltfFromUri.loaderDiagnostic",
        severity: "error",
        loaderCode: diagnostic.code,
        message: diagnostic.message,
    }));
    const diagnostics = [
        ...externalBuffers.diagnostics,
        ...externalImages.diagnostics,
        ...decodedImages.diagnostics,
        ...loaderDiagnostics,
    ];
    return {
        ok: loader.status.status === "loaded" && diagnostics.length === 0,
        url: normalizedUrl,
        byteLength: source.bytes.byteLength,
        loader,
        externalImages: decodedImages.statuses,
        diagnostics,
    };
}
function failure(url, diagnostic, byteLength = null) {
    return {
        ok: false,
        url,
        byteLength,
        loader: null,
        externalImages: [],
        diagnostics: [diagnostic],
    };
}
//# sourceMappingURL=gltf-uri-loader.js.map