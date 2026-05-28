import type {
  LoadGlbFromUriDiagnostic,
  LoadGlbFromUriDiagnosticCode,
  LoadGlbFromUriFetchResponse,
} from "./glb-uri-loader.js";
import type { FetchBytesInput } from "./glb-uri-fetch-byte-types.js";

export function fetchFailedDiagnostic(
  input: FetchBytesInput,
  error: unknown,
): LoadGlbFromUriDiagnostic {
  return {
    code: fetchFailedCode(input.context),
    severity: "error",
    message: errorMessage(error, `Fetching GLB URI '${input.url}' failed.`),
    uri: input.url,
    ...fetchIndexFields(input),
  };
}

export function httpErrorDiagnostic(
  input: FetchBytesInput,
  response: Pick<LoadGlbFromUriFetchResponse, "status" | "statusText">,
): LoadGlbFromUriDiagnostic {
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

export function readFailedDiagnostic(
  input: FetchBytesInput,
  error: unknown,
): LoadGlbFromUriDiagnostic {
  return {
    code: readFailedCode(input.context),
    severity: "error",
    message: errorMessage(
      error,
      `Reading GLB URI '${input.url}' response bytes failed.`,
    ),
    uri: input.url,
    ...fetchIndexFields(input),
  };
}

export function diagnosticForFetchInput(
  diagnostic: LoadGlbFromUriDiagnostic,
  input: FetchBytesInput,
): LoadGlbFromUriDiagnostic {
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

export function fetchIndexFields(
  input: Pick<FetchBytesInput, "bufferIndex" | "imageIndex">,
): Pick<LoadGlbFromUriDiagnostic, "bufferIndex" | "imageIndex"> {
  return {
    ...(input.bufferIndex === undefined
      ? {}
      : { bufferIndex: input.bufferIndex }),
    ...(input.imageIndex === undefined ? {} : { imageIndex: input.imageIndex }),
  };
}

function fetchDiagnosticCodeForContext(
  code: LoadGlbFromUriDiagnosticCode,
  context: FetchBytesInput["context"],
): LoadGlbFromUriDiagnosticCode {
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

function fetchFailedCode(
  context: FetchBytesInput["context"],
): LoadGlbFromUriDiagnosticCode {
  switch (context) {
    case "source":
      return "loadGlbFromUri.fetchFailed";
    case "buffer":
      return "loadGlbFromUri.bufferFetchFailed";
    case "image":
      return "loadGlbFromUri.imageFetchFailed";
  }
}

function httpErrorCode(
  context: FetchBytesInput["context"],
): LoadGlbFromUriDiagnosticCode {
  switch (context) {
    case "source":
      return "loadGlbFromUri.httpError";
    case "buffer":
      return "loadGlbFromUri.bufferHttpError";
    case "image":
      return "loadGlbFromUri.imageHttpError";
  }
}

function readFailedCode(
  context: FetchBytesInput["context"],
): LoadGlbFromUriDiagnosticCode {
  switch (context) {
    case "source":
      return "loadGlbFromUri.readFailed";
    case "buffer":
      return "loadGlbFromUri.bufferReadFailed";
    case "image":
      return "loadGlbFromUri.imageReadFailed";
  }
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
