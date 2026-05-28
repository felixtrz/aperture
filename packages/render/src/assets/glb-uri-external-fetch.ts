import type {
  LoadGlbFromUriCache,
  LoadGlbFromUriDiagnostic,
  LoadGlbFromUriFetch,
} from "./glb-uri-loader.js";
import { fetchDeduplicatedExternalBytes } from "./glb-uri-external-fetch-dedupe.js";
import {
  isRecord,
  resolveSameOriginBufferUrl,
  resolveSameOriginImageUrl,
} from "./glb-uri-external-fetch-resolve.js";
import type {
  ExternalFetchCandidate,
  FetchExternalBuffersResult,
  FetchExternalImagesResult,
} from "./glb-uri-external-fetch-types.js";

export type {
  FetchExternalBuffersResult,
  FetchExternalImagesResult,
} from "./glb-uri-external-fetch-types.js";

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

export function emptyExternalBuffers(): FetchExternalBuffersResult {
  return { bytes: new Map(), diagnostics: [] };
}

export function emptyExternalImages(): FetchExternalImagesResult {
  return { bytes: new Map(), diagnostics: [] };
}
