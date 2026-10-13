import { diagnosticForFetchInput, fetchFailedDiagnostic, httpErrorDiagnostic, readFailedDiagnostic, } from "./gltf-uri-fetch-byte-diagnostics.js";
export async function fetchBytes(input) {
    if (input.cache !== undefined) {
        return fetchBytesWithCache(input);
    }
    return fetchBytesWithoutCache(input);
}
class CachedFetchDiagnosticError extends Error {
    diagnostic;
    constructor(diagnostic) {
        super(diagnostic.message);
        this.diagnostic = diagnostic;
    }
}
async function fetchBytesWithCache(input) {
    const cache = input.cache;
    if (cache === undefined) {
        return fetchBytesWithoutCache(input);
    }
    let cached = cache.bytes.get(input.url);
    if (cached === undefined) {
        cached = fetchBytesWithoutCache(input).then((result) => {
            if (!result.ok) {
                cache.bytes.delete(input.url);
                throw new CachedFetchDiagnosticError(result.diagnostic);
            }
            return result.bytes;
        });
        cache.bytes.set(input.url, cached);
    }
    try {
        return { ok: true, bytes: await cached };
    }
    catch (error) {
        if (error instanceof CachedFetchDiagnosticError) {
            return {
                ok: false,
                diagnostic: diagnosticForFetchInput(error.diagnostic, input),
            };
        }
        return {
            ok: false,
            diagnostic: fetchFailedDiagnostic(input, error),
        };
    }
}
async function fetchBytesWithoutCache(input) {
    let response;
    try {
        response = await input.fetcher(input.url);
    }
    catch (error) {
        return {
            ok: false,
            diagnostic: fetchFailedDiagnostic(input, error),
        };
    }
    if (!response.ok) {
        return {
            ok: false,
            diagnostic: httpErrorDiagnostic(input, response),
        };
    }
    try {
        return { ok: true, bytes: await response.arrayBuffer() };
    }
    catch (error) {
        return {
            ok: false,
            diagnostic: readFailedDiagnostic(input, error),
        };
    }
}
//# sourceMappingURL=gltf-uri-fetch-bytes.js.map