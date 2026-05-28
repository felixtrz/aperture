import type {
  LoadGlbFromUriCache,
  LoadGlbFromUriDiagnostic,
  LoadGlbFromUriDiagnosticCode,
  LoadGlbFromUriFetch,
  LoadGlbFromUriFetchResponse,
} from "./glb-uri-loader.js";

interface FetchBytesInput {
  readonly url: string;
  readonly fetcher: LoadGlbFromUriFetch;
  readonly context: "source" | "buffer" | "image";
  readonly bufferIndex?: number;
  readonly imageIndex?: number;
  readonly cache?: LoadGlbFromUriCache;
}

type FetchBytesResult =
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

function fetchIndexFields(
  input: Pick<FetchBytesInput, "bufferIndex" | "imageIndex">,
): Pick<LoadGlbFromUriDiagnostic, "bufferIndex" | "imageIndex"> {
  return {
    ...(input.bufferIndex === undefined
      ? {}
      : { bufferIndex: input.bufferIndex }),
    ...(input.imageIndex === undefined ? {} : { imageIndex: input.imageIndex }),
  };
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

interface FetchExternalBuffersResult {
  readonly bytes: ReadonlyMap<number, ArrayBuffer>;
  readonly diagnostics: readonly LoadGlbFromUriDiagnostic[];
}

interface FetchExternalImagesResult {
  readonly bytes: ReadonlyMap<number, ArrayBuffer>;
  readonly diagnostics: readonly LoadGlbFromUriDiagnostic[];
}

interface ExternalFetchCandidate {
  readonly index: number;
  readonly url: string;
}

type ExternalFetchContext = "buffer" | "image";

type IndexedExternalFetchResult =
  | { readonly index: number; readonly bytes: ArrayBuffer }
  | { readonly index: number; readonly diagnostic: LoadGlbFromUriDiagnostic };

export async function fetchExternalBuffers(input: {
  readonly root: Record<string, unknown>;
  readonly sourceUrl: string;
  readonly fetcher: LoadGlbFromUriFetch;
  readonly cache?: LoadGlbFromUriCache;
  readonly provided:
    | ReadonlyMap<number, ArrayBuffer | ArrayBufferView>
    | undefined;
}): Promise<FetchExternalBuffersResult> {
  const buffers = Array.isArray(input.root.buffers) ? input.root.buffers : [];
  const sourceUrl = new URL(input.sourceUrl);
  const bytes = new Map<number, ArrayBuffer>();
  const diagnostics: LoadGlbFromUriDiagnostic[] = [];
  const candidates: ExternalFetchCandidate[] = [];

  buffers.forEach((buffer, bufferIndex) => {
    if (!isRecord(buffer) || typeof buffer.uri !== "string") {
      return;
    }

    if (input.provided?.has(bufferIndex) === true) {
      return;
    }

    const bufferUrl = resolveSameOriginBufferUrl({
      sourceUrl,
      uri: buffer.uri,
      bufferIndex,
    });

    if (!bufferUrl.ok) {
      diagnostics.push(bufferUrl.diagnostic);
      return;
    }

    candidates.push({ index: bufferIndex, url: bufferUrl.url });
  });

  const results = await fetchDeduplicatedExternalBytes({
    candidates,
    fetcher: input.fetcher,
    context: "buffer",
    ...(input.cache === undefined ? {} : { cache: input.cache }),
  });

  for (const result of results) {
    if ("diagnostic" in result) {
      diagnostics.push(result.diagnostic);
    } else {
      bytes.set(result.index, result.bytes);
    }
  }

  return { bytes, diagnostics };
}

export async function fetchExternalImages(input: {
  readonly root: Record<string, unknown>;
  readonly sourceUrl: string;
  readonly fetcher: LoadGlbFromUriFetch;
  readonly cache?: LoadGlbFromUriCache;
  readonly provided:
    | ReadonlyMap<number, ArrayBuffer | ArrayBufferView>
    | undefined;
}): Promise<FetchExternalImagesResult> {
  const images = Array.isArray(input.root.images) ? input.root.images : [];
  const sourceUrl = new URL(input.sourceUrl);
  const bytes = new Map<number, ArrayBuffer>();
  const diagnostics: LoadGlbFromUriDiagnostic[] = [];
  const candidates: ExternalFetchCandidate[] = [];

  images.forEach((image, imageIndex) => {
    if (!isRecord(image) || typeof image.uri !== "string") {
      return;
    }

    if (image.uri.startsWith("data:")) {
      return;
    }

    if (input.provided?.has(imageIndex) === true) {
      return;
    }

    const imageUrl = resolveSameOriginImageUrl({
      sourceUrl,
      image,
      imageIndex,
    });

    if (!imageUrl.ok) {
      diagnostics.push(imageUrl.diagnostic);
      return;
    }

    candidates.push({ index: imageIndex, url: imageUrl.url });
  });

  const results = await fetchDeduplicatedExternalBytes({
    candidates,
    fetcher: input.fetcher,
    context: "image",
    ...(input.cache === undefined ? {} : { cache: input.cache }),
  });

  for (const result of results) {
    if ("diagnostic" in result) {
      diagnostics.push(result.diagnostic);
    } else {
      bytes.set(result.index, result.bytes);
    }
  }

  return { bytes, diagnostics };
}

async function fetchDeduplicatedExternalBytes(input: {
  readonly candidates: readonly ExternalFetchCandidate[];
  readonly fetcher: LoadGlbFromUriFetch;
  readonly context: ExternalFetchContext;
  readonly cache?: LoadGlbFromUriCache;
}): Promise<IndexedExternalFetchResult[]> {
  const candidatesByUrl = new Map<string, ExternalFetchCandidate[]>();

  for (const candidate of input.candidates) {
    const existing = candidatesByUrl.get(candidate.url);

    if (existing === undefined) {
      candidatesByUrl.set(candidate.url, [candidate]);
    } else {
      existing.push(candidate);
    }
  }

  const resultGroups = await Promise.all(
    [...candidatesByUrl.entries()].map(async ([url, candidates]) => {
      const first = candidates[0];

      if (first === undefined) {
        return [];
      }

      const fetched = await fetchBytes({
        url,
        fetcher: input.fetcher,
        context: input.context,
        ...(input.cache === undefined ? {} : { cache: input.cache }),
        ...fetchIndexField(input.context, first.index),
      });

      if (!fetched.ok) {
        return candidates.map((candidate) => ({
          index: candidate.index,
          diagnostic: diagnosticForExternalFetchIndex(
            fetched.diagnostic,
            input.context,
            candidate.index,
          ),
        }));
      }

      return candidates.map((candidate) => ({
        index: candidate.index,
        bytes: fetched.bytes,
      }));
    }),
  );

  return resultGroups.flat();
}

function fetchIndexField(
  context: ExternalFetchContext,
  index: number,
): Pick<FetchBytesInput, "bufferIndex" | "imageIndex"> {
  return context === "buffer" ? { bufferIndex: index } : { imageIndex: index };
}

function diagnosticForExternalFetchIndex(
  diagnostic: LoadGlbFromUriDiagnostic,
  context: ExternalFetchContext,
  index: number,
): LoadGlbFromUriDiagnostic {
  return {
    code: diagnostic.code,
    severity: diagnostic.severity,
    message: diagnostic.message,
    ...(diagnostic.status === undefined ? {} : { status: diagnostic.status }),
    ...(diagnostic.statusText === undefined
      ? {}
      : { statusText: diagnostic.statusText }),
    ...(diagnostic.uri === undefined ? {} : { uri: diagnostic.uri }),
    ...(diagnostic.loaderCode === undefined
      ? {}
      : { loaderCode: diagnostic.loaderCode }),
    ...fetchIndexField(context, index),
  };
}

function resolveSameOriginBufferUrl(input: {
  readonly sourceUrl: URL;
  readonly uri: string;
  readonly bufferIndex: number;
}):
  | { readonly ok: true; readonly url: string }
  | { readonly ok: false; readonly diagnostic: LoadGlbFromUriDiagnostic } {
  if (input.uri.startsWith("data:")) {
    return {
      ok: false,
      diagnostic: {
        code: "loadGlbFromUri.unsupportedBufferUri",
        severity: "error",
        uri: input.uri,
        bufferIndex: input.bufferIndex,
        message: `GLB external buffer ${input.bufferIndex} uses an embedded data URI, which must be provided via externalBufferBytes.`,
      },
    };
  }

  return resolveSameOriginUrl({
    sourceUrl: input.sourceUrl,
    uri: input.uri,
    code: "loadGlbFromUri.unsupportedBufferUri",
    message: `GLB external buffer ${input.bufferIndex} URI '${input.uri}' is not same-origin with the source GLB.`,
    bufferIndex: input.bufferIndex,
  });
}

function resolveSameOriginImageUrl(input: {
  readonly sourceUrl: URL;
  readonly image: Record<string, unknown>;
  readonly imageIndex: number;
}):
  | { readonly ok: true; readonly url: string }
  | { readonly ok: false; readonly diagnostic: LoadGlbFromUriDiagnostic } {
  const uri = input.image.uri;

  if (typeof uri !== "string") {
    return {
      ok: false,
      diagnostic: {
        code: "loadGlbFromUri.unsupportedImageUri",
        severity: "error",
        imageIndex: input.imageIndex,
        message: `GLB image ${input.imageIndex} does not provide a URI.`,
      },
    };
  }

  return resolveSameOriginUrl({
    sourceUrl: input.sourceUrl,
    uri,
    code: "loadGlbFromUri.unsupportedImageUri",
    message: `GLB image ${input.imageIndex} URI '${uri}' is not same-origin with the source GLB.`,
    imageIndex: input.imageIndex,
  });
}

function resolveSameOriginUrl(input: {
  readonly sourceUrl: URL;
  readonly uri: string;
  readonly code:
    | "loadGlbFromUri.unsupportedBufferUri"
    | "loadGlbFromUri.unsupportedImageUri";
  readonly message: string;
  readonly bufferIndex?: number;
  readonly imageIndex?: number;
}):
  | { readonly ok: true; readonly url: string }
  | { readonly ok: false; readonly diagnostic: LoadGlbFromUriDiagnostic } {
  let url: URL;

  try {
    url = new URL(input.uri, input.sourceUrl);
  } catch {
    return {
      ok: false,
      diagnostic: {
        code: input.code,
        severity: "error",
        uri: input.uri,
        ...fetchIndexFields(input),
        message: `GLB URI '${input.uri}' could not be resolved.`,
      },
    };
  }

  if (url.origin !== input.sourceUrl.origin) {
    return {
      ok: false,
      diagnostic: {
        code: input.code,
        severity: "error",
        uri: input.uri,
        ...fetchIndexFields(input),
        message: input.message,
      },
    };
  }

  return { ok: true, url: url.href };
}

export function mergeExternalBufferBytes(
  provided: ReadonlyMap<number, ArrayBuffer | ArrayBufferView> | undefined,
  fetched: ReadonlyMap<number, ArrayBuffer>,
): ReadonlyMap<number, ArrayBuffer | ArrayBufferView> {
  if (provided === undefined || provided.size === 0) {
    return fetched;
  }

  const merged = new Map<number, ArrayBuffer | ArrayBufferView>(provided);

  for (const [bufferIndex, bytes] of fetched.entries()) {
    if (!merged.has(bufferIndex)) {
      merged.set(bufferIndex, bytes);
    }
  }

  return merged;
}

export function mergeExternalImageBytes(
  provided: ReadonlyMap<number, ArrayBuffer | ArrayBufferView> | undefined,
  fetched: ReadonlyMap<number, ArrayBuffer>,
): ReadonlyMap<number, ArrayBuffer | ArrayBufferView> {
  if (provided === undefined || provided.size === 0) {
    return fetched;
  }

  const merged = new Map<number, ArrayBuffer | ArrayBufferView>(provided);

  for (const [imageIndex, bytes] of fetched.entries()) {
    if (!merged.has(imageIndex)) {
      merged.set(imageIndex, bytes);
    }
  }

  return merged;
}

export function emptyExternalBuffers(): FetchExternalBuffersResult {
  return { bytes: new Map(), diagnostics: [] };
}

export function emptyExternalImages(): FetchExternalImagesResult {
  return { bytes: new Map(), diagnostics: [] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
