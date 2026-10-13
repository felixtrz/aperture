export function fetchFailedDiagnostic(input, error) {
    return {
        code: fetchFailedCode(input.context),
        severity: "error",
        message: errorMessage(error, `Fetching GLB URI '${input.url}' failed.`),
        uri: input.url,
        ...fetchIndexFields(input),
    };
}
export function httpErrorDiagnostic(input, response) {
    return {
        code: httpErrorCode(input.context),
        severity: "error",
        status: response.status,
        statusText: response.statusText,
        uri: input.url,
        ...fetchIndexFields(input),
        message: `Fetching GLB URI '${input.url}' failed with HTTP ${response.status}.`,
    };
}
export function readFailedDiagnostic(input, error) {
    return {
        code: readFailedCode(input.context),
        severity: "error",
        message: errorMessage(error, `Reading GLB URI '${input.url}' response bytes failed.`),
        uri: input.url,
        ...fetchIndexFields(input),
    };
}
export function diagnosticForFetchInput(diagnostic, input) {
    return {
        code: fetchDiagnosticCodeForContext(diagnostic.code, input.context),
        severity: diagnostic.severity,
        message: diagnostic.message,
        ...(diagnostic.status === undefined ? {} : { status: diagnostic.status }),
        ...(diagnostic.statusText === undefined
            ? {}
            : { statusText: diagnostic.statusText }),
        uri: diagnostic.uri ?? input.url,
        ...fetchIndexFields(input),
    };
}
export function fetchIndexFields(input) {
    return {
        ...(input.bufferIndex === undefined
            ? {}
            : { bufferIndex: input.bufferIndex }),
        ...(input.imageIndex === undefined ? {} : { imageIndex: input.imageIndex }),
    };
}
function fetchDiagnosticCodeForContext(code, context) {
    switch (code) {
        case "loadGlbFromUri.fetchFailed":
        case "loadGlbFromUri.bufferFetchFailed":
        case "loadGlbFromUri.imageFetchFailed":
            return fetchFailedCode(context);
        case "loadGlbFromUri.httpError":
        case "loadGlbFromUri.bufferHttpError":
        case "loadGlbFromUri.imageHttpError":
            return httpErrorCode(context);
        case "loadGlbFromUri.readFailed":
        case "loadGlbFromUri.bufferReadFailed":
        case "loadGlbFromUri.imageReadFailed":
            return readFailedCode(context);
        default:
            return code;
    }
}
function fetchFailedCode(context) {
    switch (context) {
        case "source":
            return "loadGlbFromUri.fetchFailed";
        case "buffer":
            return "loadGlbFromUri.bufferFetchFailed";
        case "image":
            return "loadGlbFromUri.imageFetchFailed";
    }
}
function httpErrorCode(context) {
    switch (context) {
        case "source":
            return "loadGlbFromUri.httpError";
        case "buffer":
            return "loadGlbFromUri.bufferHttpError";
        case "image":
            return "loadGlbFromUri.imageHttpError";
    }
}
function readFailedCode(context) {
    switch (context) {
        case "source":
            return "loadGlbFromUri.readFailed";
        case "buffer":
            return "loadGlbFromUri.bufferReadFailed";
        case "image":
            return "loadGlbFromUri.imageReadFailed";
    }
}
function errorMessage(error, fallback) {
    return error instanceof Error ? error.message : fallback;
}
//# sourceMappingURL=glb-uri-fetch-byte-diagnostics.js.map