import { decodeKtx2TextureDataAsync } from "../assets/ktx2-decoder.js";
import type {
  GltfDecodedImageData,
  GltfImageBytesDecoderInput,
} from "./gltf-texture-types.js";

export async function decodeImageBytesWithBrowserCanvas(
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
    }) as OffscreenCanvasRenderingContext2D | null;

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

// Worker-safe by construction: every WebGPU-capable environment ships
// OffscreenCanvas, so there is no DOM-canvas fallback here. Environments
// without it (e.g. Node) inject decodeImageData instead.
function createImageDecodeCanvas(
  width: number,
  height: number,
): OffscreenCanvas {
  if (typeof OffscreenCanvas === "function") {
    return new OffscreenCanvas(width, height);
  }

  throw new Error(
    "No browser canvas implementation is available for image decode.",
  );
}
