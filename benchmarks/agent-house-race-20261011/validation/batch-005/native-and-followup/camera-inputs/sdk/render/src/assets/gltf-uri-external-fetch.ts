import type {
  LoadGltfFromUriCache,
  LoadGltfFromUriDiagnostic,
  LoadGltfFromUriFetch,
} from "./gltf-uri-loader.js";
import { fetchDeduplicatedExternalBytes } from "./gltf-uri-external-fetch-dedupe.js";
import {
  resolveSameOriginBufferUrl,
  resolveSameOriginImageUrl,
} from "./gltf-uri-external-fetch-resolve.js";
import type {
  ExternalFetchCandidate,
  FetchExternalBuffersResult,
  FetchExternalImagesResult,
} from "./gltf-uri-external-fetch-types.js";
import {
  decodeDataUriBytes,
  isRecord,
  truncateUriForDiagnostic,
} from "./gltf-uri-shared.js";

export type {
  FetchExternalBuffersResult,
  FetchExternalImagesResult,
} from "./gltf-uri-external-fetch-types.js";

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

    // Spec-valid inline buffers (`data:application/octet-stream;base64,…`)
    // decode directly — the third standard buffer source next to external
    // .bin files and the GLB BIN chunk (#62). No network fetch is involved.
    if (buffer.uri.startsWith("data:")) {
      const decoded = decodeDataUriBytes(buffer.uri);
      if (decoded === null) {
        diagnostics.push({
          code: "loadGltfFromUri.unsupportedBufferUri",
          severity: "error",
          bufferIndex,
          uri: truncateUriForDiagnostic(buffer.uri),
          message: `glTF buffer ${bufferIndex} data URI could not be decoded; expected a base64 payload ('data:<mime>;base64,…').`,
        });
      } else {
        bytes.set(bufferIndex, decoded);
      }
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
