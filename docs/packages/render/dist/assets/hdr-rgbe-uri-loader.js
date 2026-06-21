import { parseHdrRgbe } from "./hdr-rgbe-parser.js";
export async function loadHdrFromUri(url, options = {}) {
    const normalizedUrl = normalizeUrl(url);
    if (normalizedUrl === null) {
        return loadFailure(url, {
            code: "loadHdrFromUri.invalidUrl",
            severity: "error",
            message: `HDR URI '${url}' is not a valid absolute URL.`,
        });
    }
    const fetcher = options.fetch ??
        (globalThis.fetch === undefined
            ? undefined
            : (requestUrl) => globalThis.fetch(requestUrl));
    if (fetcher === undefined) {
        return loadFailure(normalizedUrl, {
            code: "loadHdrFromUri.fetchUnavailable",
            severity: "error",
            message: "HDR URI loading requires globalThis.fetch or an explicit fetch option.",
        });
    }
    let response;
    try {
        response = await fetcher(normalizedUrl);
    }
    catch (error) {
        return loadFailure(normalizedUrl, {
            code: "loadHdrFromUri.fetchFailed",
            severity: "error",
            message: errorMessage(error, `Fetching HDR URI '${normalizedUrl}' failed.`),
        });
    }
    if (!response.ok) {
        return loadFailure(normalizedUrl, {
            code: "loadHdrFromUri.httpError",
            severity: "error",
            status: response.status,
            statusText: response.statusText,
            message: `Fetching HDR URI '${normalizedUrl}' failed with HTTP ${response.status}.`,
        });
    }
    let bytes;
    try {
        bytes = await response.arrayBuffer();
    }
    catch (error) {
        return loadFailure(normalizedUrl, {
            code: "loadHdrFromUri.readFailed",
            severity: "error",
            message: errorMessage(error, `Reading HDR URI '${normalizedUrl}' response bytes failed.`),
        });
    }
    const parsed = parseHdrRgbe(bytes);
    return {
        ok: parsed.ok,
        url: normalizedUrl,
        byteLength: bytes.byteLength,
        image: parsed.image,
        diagnostics: parsed.diagnostics.map((diagnostic) => ({
            code: "loadHdrFromUri.parseDiagnostic",
            severity: "error",
            parserCode: diagnostic.code,
            message: diagnostic.message,
        })),
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
function loadFailure(url, diagnostic) {
    return {
        ok: false,
        url,
        byteLength: null,
        image: null,
        diagnostics: [diagnostic],
    };
}
function errorMessage(error, fallback) {
    return error instanceof Error ? error.message : fallback;
}
//# sourceMappingURL=hdr-rgbe-uri-loader.js.map