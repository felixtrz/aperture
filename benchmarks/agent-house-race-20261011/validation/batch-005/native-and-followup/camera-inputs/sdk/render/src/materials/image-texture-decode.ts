import { decodeImageBytesWithBrowserCanvas } from "./gltf-texture-browser-decoder.js";
import type {
  GltfDecodedImageData,
  GltfImageBytesFetcher,
} from "./gltf-texture-types.js";

export interface DecodeImageUrlToTextureSourceOptions {
  readonly fetchImageBytes?: GltfImageBytesFetcher;
  readonly mimeType?: string;
}

export type DecodedImageTextureSource = GltfDecodedImageData;

export async function decodeImageUrlToTextureSource(
  url: string,
  options: DecodeImageUrlToTextureSourceOptions = {},
): Promise<DecodedImageTextureSource> {
  const source = {
    kind: "uri" as const,
    uri: url,
    ...(options.mimeType === undefined ? {} : { mimeType: options.mimeType }),
  };
  const fetched = await fetchImageBytes(url, options);

  return decodeImageBytesWithBrowserCanvas({
    source,
    bytes: fetched.bytes,
    ...(fetched.mimeType === undefined ? {} : { mimeType: fetched.mimeType }),
  });
}

async function fetchImageBytes(
  url: string,
  options: DecodeImageUrlToTextureSourceOptions,
): Promise<{ readonly bytes: Uint8Array; readonly mimeType?: string }> {
  if (options.fetchImageBytes !== undefined) {
    const source = {
      kind: "uri" as const,
      uri: url,
      ...(options.mimeType === undefined ? {} : { mimeType: options.mimeType }),
    };
    const result = await options.fetchImageBytes({
      uri: url,
      source,
      ...(options.mimeType === undefined ? {} : { mimeType: options.mimeType }),
    });

    return {
      bytes: await bytesFromFetchResult(result),
      ...(options.mimeType === undefined ? {} : { mimeType: options.mimeType }),
    };
  }

  if (typeof fetch !== "function") {
    throw new Error("No fetch implementation is available for image decode.");
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Image '${url}' failed to load with HTTP ${response.status}.`,
    );
  }

  const contentType = response.headers.get("content-type") ?? undefined;
  const mimeType = options.mimeType ?? contentType;
  return {
    bytes: new Uint8Array(await response.arrayBuffer()),
    ...(mimeType === undefined ? {} : { mimeType }),
  };
}

async function bytesFromFetchResult(
  result: Awaited<ReturnType<GltfImageBytesFetcher>>,
): Promise<Uint8Array> {
  if (result instanceof Uint8Array) {
    return result;
  }

  if (ArrayBuffer.isView(result)) {
    return new Uint8Array(result.buffer, result.byteOffset, result.byteLength);
  }

  if (result instanceof ArrayBuffer) {
    return new Uint8Array(result);
  }

  if (typeof Blob !== "undefined" && result instanceof Blob) {
    return new Uint8Array(await result.arrayBuffer());
  }

  if (typeof Response !== "undefined" && result instanceof Response) {
    if (!result.ok) {
      throw new Error(`Image response failed with HTTP ${result.status}.`);
    }

    return new Uint8Array(await result.arrayBuffer());
  }

  throw new Error("Image byte fetcher returned an unsupported result.");
}
