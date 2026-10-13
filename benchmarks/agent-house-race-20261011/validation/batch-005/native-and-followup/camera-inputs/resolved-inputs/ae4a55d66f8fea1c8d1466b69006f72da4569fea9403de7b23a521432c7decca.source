import { errorMessage } from "./gltf-uri-shared.js";
export function fetchFailedDiagnostic(input, error) {
    return {
        code: fetchFailedCode(input.context),
        severity: "error",
        message: errorMessage(error, `Fetching glTF URI '${input.url}' failed.`),
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
        message: `Fetching glTF URI '${input.url}' failed with HTTP ${response.status}.`,
    };
}
export function readFailedDiagnostic(input, error) {
    return {
        code: readFailedCode(input.context),
        severity: "error",
        message: errorMessage(error, `Reading glTF URI '${input.url}' response bytes failed.`),
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
function fetchIndexFields(input) {
    return {
        ...(input.bufferIndex === undefined
            ? {}
            : { bufferIndex: input.bufferIndex }),
        ...(input.imageIndex === undefined ? {} : { imageIndex: input.imageIndex }),
    };
}
function fetchDiagnosticCodeForContext(code, context) {
    switch (code) {
        case "loadGltfFromUri.fetchFailed":
        case "loadGltfFromUri.bufferFetchFailed":
        case "loadGltfFromUri.imageFetchFailed":
            return fetchFailedCode(context);
        case "loadGltfFromUri.httpError":
        case "loadGltfFromUri.bufferHttpError":
        case "loadGltfFromUri.imageHttpError":
            return httpErrorCode(context);
        case "loadGltfFromUri.readFailed":
        case "loadGltfFromUri.bufferReadFailed":
        case "loadGltfFromUri.imageReadFailed":
            return readFailedCode(context);
        default:
            return code;
    }
}
function fetchFailedCode(context) {
    switch (context) {
        case "source":
            return "loadGltfFromUri.fetchFailed";
        case "buffer":
            return "loadGltfFromUri.bufferFetchFailed";
        case "image":
            return "loadGltfFromUri.imageFetchFailed";
    }
}
function httpErrorCode(context) {
    switch (context) {
        case "source":
            return "loadGltfFromUri.httpError";
        case "buffer":
            return "loadGltfFromUri.bufferHttpError";
        case "image":
            return "loadGltfFromUri.imageHttpError";
    }
}
function readFailedCode(context) {
    switch (context) {
        case "source":
            return "loadGltfFromUri.readFailed";
        case "buffer":
            return "loadGltfFromUri.bufferReadFailed";
        case "image":
            return "loadGltfFromUri.imageReadFailed";
    }
}
//# sourceMappingURL=gltf-uri-fetch-byte-diagnostics.js.map