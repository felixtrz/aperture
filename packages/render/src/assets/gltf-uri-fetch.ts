import type {
  LoadGltfFromUriCache,
  LoadGltfFromUriDiagnostic,
  LoadGltfFromUriDiagnosticCode,
  LoadGltfFromUriFetch,
  LoadGltfFromUriFetchResponse,
} from "./gltf-uri-loader.js";
import {
  errorMessage,
  isRecord,
  mimeTypeFromImage,
} from "./gltf-uri-shared.js";

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

export type ParseGltfJsonResult =
  | { readonly ok: true; readonly root: Record<string, unknown> }
  | { readonly ok: false; readonly diagnostic: LoadGltfFromUriDiagnostic };

export function parseGltfJson(
  url: string,
  bytes: ArrayBuffer,
): ParseGltfJsonResult {
  let text: string;

  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch (error) {
    return invalidJson(url, error);
  }

  try {
    const parsed: unknown = JSON.parse(text);

    if (!isRecord(parsed)) {
      return invalidJson(url, null);
    }

    return { ok: true, root: parsed };
  } catch (error) {
    return invalidJson(url, error);
  }
}

function invalidJson(
  url: string,
  error: unknown,
): { readonly ok: false; readonly diagnostic: LoadGltfFromUriDiagnostic } {
  return {
    ok: false,
    diagnostic: {
      code: "loadGltfFromUri.invalidJson",
      severity: "error",
      uri: url,
      message: errorMessage(error, `glTF URI '${url}' did not contain JSON.`),
    },
  };
}

export interface FetchExternalBuffersResult {
  readonly bytes: ReadonlyMap<number, ArrayBuffer>;
  readonly diagnostics: readonly LoadGltfFromUriDiagnostic[];
}

interface ExternalFetchCandidate {
  readonly index: number;
  readonly url: string;
}

type ExternalFetchContext = "buffer" | "image";

type IndexedExternalFetchResult =
  | { readonly index: number; readonly bytes: ArrayBuffer }
  | { readonly index: number; readonly diagnostic: LoadGltfFromUriDiagnostic };

export async function fetchExternalBuffers(input: {
  readonly root: Record<string, unknown>;
  readonly sourceUrl: string;
  readonly fetcher: LoadGltfFromUriFetch;
  readonly cache?: LoadGltfFromUriCache;
}): Promise<FetchExternalBuffersResult> {
  const buffers = Array.isArray(input.root.buffers) ? input.root.buffers : [];
  const sourceUrl = new URL(input.sourceUrl);
  const bytes = new Map<number, ArrayBuffer>();
  const diagnostics: LoadGltfFromUriDiagnostic[] = [];
  const candidates: ExternalFetchCandidate[] = [];

  buffers.forEach((buffer, bufferIndex) => {
    if (!isRecord(buffer) || typeof buffer.uri !== "string") {
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

export interface FetchExternalImagesResult {
  readonly bytes: ReadonlyMap<number, ArrayBuffer>;
  readonly diagnostics: readonly LoadGltfFromUriDiagnostic[];
}

export async function fetchExternalImages(input: {
  readonly root: Record<string, unknown>;
  readonly sourceUrl: string;
  readonly fetcher: LoadGltfFromUriFetch;
  readonly cache?: LoadGltfFromUriCache;
  readonly provided:
    | ReadonlyMap<number, ArrayBuffer | ArrayBufferView>
    | undefined;
}): Promise<FetchExternalImagesResult> {
  const images = Array.isArray(input.root.images) ? input.root.images : [];
  const sourceUrl = new URL(input.sourceUrl);
  const bytes = new Map<number, ArrayBuffer>();
  const diagnostics: LoadGltfFromUriDiagnostic[] = [];
  const candidates: ExternalFetchCandidate[] = [];

  images.forEach((image, imageIndex) => {
    if (!isRecord(image) || typeof image.uri !== "string") {
      return;
    }

    if (image.uri.startsWith("data:")) {
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

    if (input.provided?.has(imageIndex) === true) {
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
  readonly fetcher: LoadGltfFromUriFetch;
  readonly context: ExternalFetchContext;
  readonly cache?: LoadGltfFromUriCache;
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
  diagnostic: LoadGltfFromUriDiagnostic,
  context: ExternalFetchContext,
  index: number,
): LoadGltfFromUriDiagnostic {
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

type ResolveBufferUrlResult =
  | { readonly ok: true; readonly url: string }
  | { readonly ok: false; readonly diagnostic: LoadGltfFromUriDiagnostic };

function resolveSameOriginBufferUrl(input: {
  readonly sourceUrl: URL;
  readonly uri: string;
  readonly bufferIndex: number;
}): ResolveBufferUrlResult {
  if (input.uri.startsWith("data:")) {
    return {
      ok: false,
      diagnostic: {
        code: "loadGltfFromUri.unsupportedBufferUri",
        severity: "error",
        bufferIndex: input.bufferIndex,
        uri: input.uri,
        message: `glTF buffer ${input.bufferIndex} uses a data URI; this loader currently expects same-origin external buffer files.`,
      },
    };
  }

  let url: URL;

  try {
    url = new URL(input.uri, input.sourceUrl);
  } catch {
    return {
      ok: false,
      diagnostic: {
        code: "loadGltfFromUri.unsupportedBufferUri",
        severity: "error",
        bufferIndex: input.bufferIndex,
        uri: input.uri,
        message: `glTF buffer ${input.bufferIndex} URI '${input.uri}' could not be resolved.`,
      },
    };
  }

  if (url.origin !== input.sourceUrl.origin) {
    return {
      ok: false,
      diagnostic: {
        code: "loadGltfFromUri.unsupportedBufferUri",
        severity: "error",
        bufferIndex: input.bufferIndex,
        uri: input.uri,
        message: `glTF buffer ${input.bufferIndex} URI '${input.uri}' is not same-origin with the glTF source.`,
      },
    };
  }

  return { ok: true, url: url.href };
}

type ResolveImageUrlResult =
  | { readonly ok: true; readonly url: string }
  | { readonly ok: false; readonly diagnostic: LoadGltfFromUriDiagnostic };

function resolveSameOriginImageUrl(input: {
  readonly sourceUrl: URL;
  readonly image: Record<string, unknown>;
  readonly imageIndex: number;
}): ResolveImageUrlResult {
  const uri = input.image.uri;

  if (typeof uri !== "string") {
    return {
      ok: false,
      diagnostic: {
        code: "loadGltfFromUri.unsupportedImageUri",
        severity: "error",
        imageIndex: input.imageIndex,
        message: `glTF image ${input.imageIndex} does not provide a URI.`,
      },
    };
  }

  const mimeType = mimeTypeFromImage(input.image, uri);

  if (mimeType === null) {
    return {
      ok: false,
      diagnostic: {
        code: "loadGltfFromUri.unsupportedImageUri",
        severity: "error",
        imageIndex: input.imageIndex,
        uri,
        message: `glTF image ${input.imageIndex} URI '${uri}' has an unsupported or unknown image format.`,
      },
    };
  }

  let url: URL;

  try {
    url = new URL(uri, input.sourceUrl);
  } catch {
    return {
      ok: false,
      diagnostic: {
        code: "loadGltfFromUri.unsupportedImageUri",
        severity: "error",
        imageIndex: input.imageIndex,
        uri,
        message: `glTF image ${input.imageIndex} URI '${uri}' could not be resolved.`,
      },
    };
  }

  if (url.origin !== input.sourceUrl.origin) {
    return {
      ok: false,
      diagnostic: {
        code: "loadGltfFromUri.unsupportedImageUri",
        severity: "error",
        imageIndex: input.imageIndex,
        uri,
        message: `glTF image ${input.imageIndex} URI '${uri}' is not same-origin with the glTF source.`,
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
