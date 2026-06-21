import { parseGlbContainer } from "./glb-container.js";
import { createNoFetchGlbSourceLoaderReport } from "./glb-source-loader-facade.js";
import { resolveDracoDecoder, resolveMeshoptDecoder, } from "./glb-uri-loader-decoders.js";
import { emptyExternalBuffers, emptyExternalImages, fetchBytes, fetchExternalBuffers, fetchExternalImages, mergeExternalBufferBytes, mergeExternalImageBytes, } from "./glb-uri-fetch.js";
import { createMergedImageDataResolver, decodeExternalImages, emptyDecodedImages, mergeDecodedImageData, normalizeConcurrency, } from "./glb-uri-images.js";
export function createGlbUriLoadCache() {
    return {
        bytes: new Map(),
        decodedImages: new Map(),
    };
}
export async function loadGlbFromUri(url, options = {}) {
    const normalizedUrl = normalizeUrl(url);
    if (normalizedUrl === null) {
        return failure(url, {
            code: "loadGlbFromUri.invalidUrl",
            severity: "error",
            message: `GLB URI '${url}' is not a valid absolute URL.`,
        });
    }
    const fetcher = options.fetch ??
        (globalThis.fetch === undefined
            ? undefined
            : (requestUrl) => globalThis.fetch(requestUrl));
    if (fetcher === undefined) {
        return failure(normalizedUrl, {
            code: "loadGlbFromUri.fetchUnavailable",
            severity: "error",
            message: "GLB URI loading requires globalThis.fetch or an explicit fetch option.",
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
    const container = parseGlbContainer(source.bytes);
    const root = container.container?.json ?? null;
    const binary = container.container?.binaryChunk ?? null;
    const { fetch: _fetch, cache: _cache, decodeImageData, basisTranscoder, createBasisKtx2Transcoder, ktx2TextureCompression, imageDecodeConcurrency, externalBufferBytes: providedBuffers, externalImageBytes: providedImages, decodedImageData: providedDecodedImages, resolveImageData, dracoDecoder: providedDracoDecoder, meshoptDecoder: providedMeshoptDecoder, createDracoDecoder, createMeshoptDecoder, ...loaderOptions } = options;
    const externalBuffers = root === null
        ? emptyExternalBuffers()
        : await fetchExternalBuffers({
            root,
            sourceUrl: normalizedUrl,
            fetcher,
            provided: providedBuffers,
            ...(options.cache === undefined ? {} : { cache: options.cache }),
        });
    const mergedExternalBuffers = mergeExternalBufferBytes(providedBuffers, externalBuffers.bytes);
    const externalImages = root === null
        ? emptyExternalImages()
        : await fetchExternalImages({
            root,
            sourceUrl: normalizedUrl,
            fetcher,
            provided: providedImages,
            ...(options.cache === undefined ? {} : { cache: options.cache }),
        });
    const mergedExternalImages = mergeExternalImageBytes(providedImages, externalImages.bytes);
    const decodedImages = root === null
        ? emptyDecodedImages()
        : await decodeExternalImages({
            root,
            binary,
            sourceUrl: normalizedUrl,
            externalBufferBytes: mergedExternalBuffers,
            externalImageBytes: mergedExternalImages,
            ...(decodeImageData === undefined ? {} : { decodeImageData }),
            ...(basisTranscoder === undefined ? {} : { basisTranscoder }),
            ...(createBasisKtx2Transcoder === undefined
                ? {}
                : { createBasisKtx2Transcoder }),
            ...(ktx2TextureCompression === undefined
                ? {}
                : { ktx2TextureCompression }),
            imageDecodeConcurrency: normalizeConcurrency(imageDecodeConcurrency, 4),
            ...(options.cache === undefined ? {} : { cache: options.cache }),
        });
    const mergedDecodedImages = mergeDecodedImageData(providedDecodedImages, decodedImages.images);
    const [dracoDecoder, meshoptDecoder] = await Promise.all([
        resolveDracoDecoder({
            root,
            provided: providedDracoDecoder,
            create: createDracoDecoder,
        }),
        resolveMeshoptDecoder({
            root,
            provided: providedMeshoptDecoder,
            create: createMeshoptDecoder,
        }),
    ]);
    const loader = createNoFetchGlbSourceLoaderReport({
        ...loaderOptions,
        source: source.bytes,
        externalBufferBytes: mergedExternalBuffers,
        decodedImageData: mergedDecodedImages,
        resolveImageData: createMergedImageDataResolver({
            decodedImages: mergedDecodedImages,
            fallback: resolveImageData,
        }),
        ...(dracoDecoder === undefined ? {} : { dracoDecoder }),
        ...(meshoptDecoder === undefined ? {} : { meshoptDecoder }),
    });
    const loaderDiagnostics = loader.status.diagnostics.map((diagnostic) => ({
        code: "loadGlbFromUri.loaderDiagnostic",
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
function normalizeUrl(url) {
    try {
        return new URL(url).href;
    }
    catch {
        return null;
    }
}
function failure(url, diagnostic) {
    return {
        ok: false,
        url,
        byteLength: null,
        loader: null,
        externalImages: [],
        diagnostics: [diagnostic],
    };
}
//# sourceMappingURL=glb-uri-loader.js.map