import type {
  LoadGltfFromUriDiagnostic,
  LoadGltfFromUriDiagnosticCode,
  LoadGltfFromUriFetchResponse,
} from "./gltf-uri-loader.js";
import type { FetchBytesInput } from "./gltf-uri-fetch-byte-types.js";
import { errorMessage } from "./gltf-uri-shared.js";

export function fetchFailedDiagnostic(
  input: FetchBytesInput,
  error: unknown,
): LoadGltfFromUriDiagnostic {
  return {
    code: fetchFailedCode(input.context),
    severity: "error",
    message: errorMessage(error, `Fetching glTF URI '${input.url}' failed.`),
    uri: input.url,
    ...fetchIndexFields(input),
  };
}

export function httpErrorDiagnostic(
  input: FetchBytesInput,
  response: Pick<LoadGltfFromUriFetchResponse, "status" | "statusText">,
): LoadGltfFromUriDiagnostic {
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

export function readFailedDiagnostic(
  input: FetchBytesInput,
  error: unknown,
): LoadGltfFromUriDiagnostic {
  return {
    code: readFailedCode(input.context),
    severity: "error",
    message: errorMessage(
      error,
      `Reading glTF URI '${input.url}' response bytes failed.`,
    ),
    uri: input.url,
    ...fetchIndexFields(input),
  };
}

export function diagnosticForFetchInput(
  diagnostic: LoadGltfFromUriDiagnostic,
  input: FetchBytesInput,
): LoadGltfFromUriDiagnostic {
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

function fetchIndexFields(
  input: Pick<FetchBytesInput, "bufferIndex" | "imageIndex">,
): Pick<LoadGltfFromUriDiagnostic, "bufferIndex" | "imageIndex"> {
  return {
    ...(input.bufferIndex === undefined
      ? {}
      : { bufferIndex: input.bufferIndex }),
    ...(input.imageIndex === undefined ? {} : { imageIndex: input.imageIndex }),
  };
}

function fetchDiagnosticCodeForContext(
  code: LoadGltfFromUriDiagnosticCode,
  context: FetchBytesInput["context"],
): LoadGltfFromUriDiagnosticCode {
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

function fetchFailedCode(
  context: FetchBytesInput["context"],
): LoadGltfFromUriDiagnosticCode {
  switch (context) {
    case "source":
      return "loadGltfFromUri.fetchFailed";
    case "buffer":
      return "loadGltfFromUri.bufferFetchFailed";
    case "image":
      return "loadGltfFromUri.imageFetchFailed";
  }
}

function httpErrorCode(
  context: FetchBytesInput["context"],
): LoadGltfFromUriDiagnosticCode {
  switch (context) {
    case "source":
      return "loadGltfFromUri.httpError";
    case "buffer":
      return "loadGltfFromUri.bufferHttpError";
    case "image":
      return "loadGltfFromUri.imageHttpError";
  }
}

function readFailedCode(
  context: FetchBytesInput["context"],
): LoadGltfFromUriDiagnosticCode {
  switch (context) {
    case "source":
      return "loadGltfFromUri.readFailed";
    case "buffer":
      return "loadGltfFromUri.bufferReadFailed";
    case "image":
      return "loadGltfFromUri.imageReadFailed";
  }
}
