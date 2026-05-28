import type {
  LoadGltfFromUriCache,
  LoadGltfFromUriDiagnostic,
  LoadGltfFromUriDiagnosticCode,
  LoadGltfFromUriFetch,
  LoadGltfFromUriFetchResponse,
} from "./gltf-uri-loader.js";
import { errorMessage } from "./gltf-uri-shared.js";

export interface FetchBytesInput {
  readonly url: string;
  readonly fetcher: LoadGltfFromUriFetch;
  readonly context: "source" | "buffer" | "image";
  readonly bufferIndex?: number;
  readonly imageIndex?: number;
  readonly cache?: LoadGltfFromUriCache;
}

export type FetchBytesResult =
  | { readonly ok: true; readonly bytes: ArrayBuffer }
  | { readonly ok: false; readonly diagnostic: LoadGltfFromUriDiagnostic };

export async function fetchBytes(
  input: FetchBytesInput,
): Promise<FetchBytesResult> {
  if (input.cache !== undefined) {
    return fetchBytesWithCache(input);
  }

  return fetchBytesWithoutCache(input);
}

class CachedFetchDiagnosticError extends Error {
  constructor(readonly diagnostic: LoadGltfFromUriDiagnostic) {
    super(diagnostic.message);
  }
}

async function fetchBytesWithCache(
  input: FetchBytesInput,
): Promise<FetchBytesResult> {
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
  } catch (error) {
    if (error instanceof CachedFetchDiagnosticError) {
      return {
        ok: false,
        diagnostic: diagnosticForFetchInput(error.diagnostic, input),
      };
    }

    return {
      ok: false,
      diagnostic: {
        code: fetchFailedCode(input.context),
        severity: "error",
        message: errorMessage(
          error,
          `Fetching glTF URI '${input.url}' failed.`,
        ),
        uri: input.url,
        ...(input.bufferIndex === undefined
          ? {}
          : { bufferIndex: input.bufferIndex }),
        ...(input.imageIndex === undefined
          ? {}
          : { imageIndex: input.imageIndex }),
      },
    };
  }
}

function diagnosticForFetchInput(
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

async function fetchBytesWithoutCache(
  input: FetchBytesInput,
): Promise<FetchBytesResult> {
  let response: LoadGltfFromUriFetchResponse;

  try {
    response = await input.fetcher(input.url);
  } catch (error) {
    return {
      ok: false,
      diagnostic: {
        code: fetchFailedCode(input.context),
        severity: "error",
        message: errorMessage(
          error,
          `Fetching glTF URI '${input.url}' failed.`,
        ),
        uri: input.url,
        ...(input.bufferIndex === undefined
          ? {}
          : { bufferIndex: input.bufferIndex }),
        ...(input.imageIndex === undefined
          ? {}
          : { imageIndex: input.imageIndex }),
      },
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      diagnostic: {
        code: httpErrorCode(input.context),
        severity: "error",
        status: response.status,
        statusText: response.statusText,
        uri: input.url,
        ...(input.bufferIndex === undefined
          ? {}
          : { bufferIndex: input.bufferIndex }),
        ...(input.imageIndex === undefined
          ? {}
          : { imageIndex: input.imageIndex }),
        message: `Fetching glTF URI '${input.url}' failed with HTTP ${response.status}.`,
      },
    };
  }

  try {
    return { ok: true, bytes: await response.arrayBuffer() };
  } catch (error) {
    return {
      ok: false,
      diagnostic: {
        code: readFailedCode(input.context),
        severity: "error",
        message: errorMessage(
          error,
          `Reading glTF URI '${input.url}' response bytes failed.`,
        ),
        uri: input.url,
        ...(input.bufferIndex === undefined
          ? {}
          : { bufferIndex: input.bufferIndex }),
        ...(input.imageIndex === undefined
          ? {}
          : { imageIndex: input.imageIndex }),
      },
    };
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
