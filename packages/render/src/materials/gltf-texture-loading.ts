import { decodeKtx2TextureDataAsync } from "../assets/ktx2-decoder.js";
import type {
  GltfDecodedImageData,
  GltfImageBytesDecoderInput,
  GltfImageFetchResult,
  GltfImageSourceRef,
  GltfTextureAsyncLoadSource,
} from "./gltf-texture-types.js";
import {
  bytesView,
  isRecord,
  mimeTypeFromUri,
  validDecodedImage,
} from "./gltf-texture-utils.js";

export async function loadGltfTextureAsync(
  source: GltfTextureAsyncLoadSource,
): Promise<GltfDecodedImageData> {
  const bytes = await loadGltfImageBytes(source);
  const mimeType = mimeTypeFromImageSource(source.source);

  if (mimeType === "image/ktx2" && source.decodeImageData === undefined) {
    const image = await decodeKtx2TextureDataAsync(bytes, {
      ...(source.basisTranscoder === undefined
        ? {}
        : { basisTranscoder: source.basisTranscoder }),
      ...(source.ktx2TextureCompression === undefined
        ? {}
        : { textureCompression: source.ktx2TextureCompression }),
    });

    if (!validDecodedImage(image)) {
      throw new Error(
        "Decoded glTF image data must include positive dimensions, row stride, and Uint8Array bytes.",
      );
    }

    return image;
  }

  const decoder = source.decodeImageData ?? decodeImageBytesWithBrowserCanvas;
  const image = await decoder({
    source: source.source,
    bytes,
    ...(mimeType === undefined ? {} : { mimeType }),
  });

  if (!validDecodedImage(image)) {
    throw new Error(
      "Decoded glTF image data must include positive dimensions, row stride, and Uint8Array bytes.",
    );
  }

  return image;
}

async function loadGltfImageBytes(
  input: GltfTextureAsyncLoadSource,
): Promise<Uint8Array> {
  if (input.bytes !== undefined) {
    return bytesView(input.bytes);
  }

  if (input.source.kind === "uri") {
    if (input.source.uri.startsWith("data:")) {
      return decodeDataUriBytes(input.source.uri);
    }

    return fetchGltfImageBytes(input);
  }

  throw new Error(
    `glTF bufferView image ${input.source.bufferView} requires bytes before async decode.`,
  );
}

async function fetchGltfImageBytes(
  input: GltfTextureAsyncLoadSource,
): Promise<Uint8Array> {
  if (input.source.kind !== "uri") {
    throw new Error("Only glTF URI image sources can be fetched.");
  }

  const mimeType = mimeTypeFromImageSource(input.source);
  const fetchResult =
    input.fetchImageBytes === undefined
      ? await fetchUriImageBytes(input.source.uri)
      : await input.fetchImageBytes({
          uri: input.source.uri,
          source: input.source,
          ...(mimeType === undefined ? {} : { mimeType }),
        });

  return bytesFromFetchResult(fetchResult);
}

async function fetchUriImageBytes(uri: string): Promise<GltfImageFetchResult> {
  if (typeof fetch !== "function") {
    throw new Error(
      "No fetch implementation is available for glTF URI image loading.",
    );
  }

  const response = await fetch(uri);

  if (!response.ok) {
    throw new Error(
      `Fetching glTF image URI '${uri}' failed with HTTP ${response.status}.`,
    );
  }

  return response;
}

async function bytesFromFetchResult(
  resultValue: GltfImageFetchResult,
): Promise<Uint8Array> {
  if (isResponseLike(resultValue)) {
    if (!resultValue.ok) {
      throw new Error(
        `Fetching glTF image failed with HTTP ${resultValue.status}.`,
      );
    }

    return new Uint8Array(await resultValue.arrayBuffer());
  }

  if (isBlobLike(resultValue)) {
    return new Uint8Array(await resultValue.arrayBuffer());
  }

  return bytesView(resultValue);
}

async function decodeImageBytesWithBrowserCanvas(
  input: GltfImageBytesDecoderInput,
): Promise<GltfDecodedImageData> {
  if (input.mimeType === "image/ktx2") {
    return decodeKtx2TextureDataAsync(input.bytes);
  }

  if (typeof Blob === "undefined" || typeof createImageBitmap !== "function") {
    throw new Error(
      "No browser image decoder is available; provide decodeImageData for this glTF image source.",
    );
  }

  const blob = new Blob([blobPartFromBytes(input.bytes)], {
    ...(input.mimeType === undefined ? {} : { type: input.mimeType }),
  });
  const bitmap = await createImageBitmap(blob);

  try {
    const canvas = createImageDecodeCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext("2d", {
      willReadFrequently: true,
    }) as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;

    if (context === null) {
      throw new Error("Could not create a 2D canvas context for image decode.");
    }

    context.drawImage(bitmap, 0, 0);
    const pixels = context.getImageData(0, 0, bitmap.width, bitmap.height);

    return {
      width: bitmap.width,
      height: bitmap.height,
      sourceData: {
        bytes: new Uint8Array(
          pixels.data.buffer,
          pixels.data.byteOffset,
          pixels.data.byteLength,
        ),
        bytesPerRow: bitmap.width * 4,
        rowsPerImage: bitmap.height,
      },
    };
  } finally {
    bitmap.close();
  }
}

function blobPartFromBytes(
  bytes: Uint8Array,
): ArrayBuffer | ArrayBufferView<ArrayBuffer> {
  const buffer = bytes.buffer;

  if (buffer instanceof ArrayBuffer) {
    if (bytes.byteOffset === 0 && bytes.byteLength === buffer.byteLength) {
      return buffer;
    }

    return new Uint8Array(buffer, bytes.byteOffset, bytes.byteLength);
  }

  const copiedBuffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copiedBuffer).set(bytes);
  return copiedBuffer;
}

function createImageDecodeCanvas(
  width: number,
  height: number,
): OffscreenCanvas | HTMLCanvasElement {
  if (typeof OffscreenCanvas === "function") {
    return new OffscreenCanvas(width, height);
  }

  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  throw new Error(
    "No browser canvas implementation is available for image decode.",
  );
}

function decodeDataUriBytes(uri: string): Uint8Array {
  const match = /^data:([^,]*),(.*)$/u.exec(uri);

  if (match === null) {
    throw new Error("Malformed glTF data URI image source.");
  }

  const metadata = match[1] ?? "";
  const payload = match[2] ?? "";

  if (metadata.split(";").includes("base64")) {
    if (typeof atob !== "function") {
      throw new Error(
        "No base64 decoder is available for glTF data URI image.",
      );
    }

    const binary = atob(decodeURIComponent(payload));
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    return bytes;
  }

  const text = decodeURIComponent(payload);
  const bytes = new Uint8Array(text.length);

  for (let index = 0; index < text.length; index += 1) {
    bytes[index] = text.charCodeAt(index) & 0xff;
  }

  return bytes;
}

function mimeTypeFromImageSource(
  source: GltfImageSourceRef,
): string | undefined {
  return source.kind === "bufferView"
    ? source.mimeType
    : (source.mimeType ?? mimeTypeFromUri(source.uri));
}

function isResponseLike(value: unknown): value is Response {
  return (
    isRecord(value) &&
    typeof value.arrayBuffer === "function" &&
    typeof value.ok === "boolean"
  );
}

function isBlobLike(value: unknown): value is Blob {
  return (
    isRecord(value) &&
    typeof value.arrayBuffer === "function" &&
    typeof value.size === "number"
  );
}
