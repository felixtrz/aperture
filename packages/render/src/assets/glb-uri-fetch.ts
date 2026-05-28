import type {
  LoadGlbFromUriCache,
  LoadGlbFromUriDiagnostic,
  LoadGlbFromUriFetch,
} from "./glb-uri-loader.js";
import {
  fetchBytes,
  fetchIndexFields,
  type FetchBytesInput,
} from "./glb-uri-fetch-bytes.js";

export { fetchBytes } from "./glb-uri-fetch-bytes.js";
export type {
  FetchBytesInput,
  FetchBytesResult,
} from "./glb-uri-fetch-bytes.js";

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
