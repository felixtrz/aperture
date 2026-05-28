import type {
  LoadGlbFromUriCache,
  LoadGlbFromUriDiagnostic,
  LoadGlbFromUriDiagnosticCode,
  LoadGlbFromUriFetch,
  LoadGlbFromUriFetchResponse,
} from "./glb-uri-loader.js";

export interface FetchBytesInput {
  readonly url: string;
  readonly fetcher: LoadGlbFromUriFetch;
  readonly context: "source" | "buffer" | "image";
  readonly bufferIndex?: number;
  readonly imageIndex?: number;
  readonly cache?: LoadGlbFromUriCache;
}

export type FetchBytesResult =
  | { readonly ok: true; readonly bytes: ArrayBuffer }
  | { readonly ok: false; readonly diagnostic: LoadGlbFromUriDiagnostic };

export async function fetchBytes(
  input: FetchBytesInput,
): Promise<FetchBytesResult> {
  if (input.cache !== undefined) {
    return fetchBytesWithCache(input);
  }

  return fetchBytesWithoutCache(input);
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

class CachedFetchDiagnosticError extends Error {
  constructor(readonly diagnostic: LoadGlbFromUriDiagnostic) {
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
        message: errorMessage(error, `Fetching GLB URI '${input.url}' failed.`),
        uri: input.url,
        ...fetchIndexFields(input),
      },
    };
  }
}

function diagnosticForFetchInput(
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

async function fetchBytesWithoutCache(
  input: FetchBytesInput,
): Promise<FetchBytesResult> {
  let response: LoadGlbFromUriFetchResponse;

  try {
    response = await input.fetcher(input.url);
  } catch (error) {
    return {
      ok: false,
      diagnostic: {
        code: fetchFailedCode(input.context),
        severity: "error",
        message: errorMessage(error, `Fetching GLB URI '${input.url}' failed.`),
        uri: input.url,
        ...fetchIndexFields(input),
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
        ...fetchIndexFields(input),
        message: `Fetching GLB URI '${input.url}' failed with HTTP ${response.status}.`,
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
          `Reading GLB URI '${input.url}' response bytes failed.`,
        ),
        uri: input.url,
        ...fetchIndexFields(input),
      },
    };
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
