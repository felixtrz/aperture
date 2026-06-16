import { describe, expect, it } from "vitest";
import { decodeImageUrlToTextureSource } from "@aperture-engine/render";

describe("image texture URL decode", () => {
  it("fetches image bytes and decodes them into texture source data", async () => {
    const globals = globalThis as unknown as Record<string, unknown>;
    const previousCreateImageBitmap = globals.createImageBitmap;
    const previousOffscreenCanvas = globals.OffscreenCanvas;
    const decodedPixels = new Uint8ClampedArray([9, 18, 27, 255]);
    const fetchedBytes = new Uint8Array([1, 2, 3]);
    let bitmapClosed = false;
    let fetchedUri = "";

    class FakeOffscreenCanvas {
      constructor(
        readonly width: number,
        readonly height: number,
      ) {}

      getContext(type: string): unknown {
        expect(type).toBe("2d");
        return {
          drawImage: () => {},
          getImageData: () => ({ data: decodedPixels }),
        };
      }
    }

    globals.createImageBitmap = async () => ({
      width: 1,
      height: 1,
      close: () => {
        bitmapClosed = true;
      },
    });
    globals.OffscreenCanvas = FakeOffscreenCanvas;

    try {
      const decoded = await decodeImageUrlToTextureSource("/sprite.png", {
        mimeType: "image/png",
        fetchImageBytes(input) {
          fetchedUri = input.uri;
          return Promise.resolve(fetchedBytes);
        },
      });

      expect(fetchedUri).toBe("/sprite.png");
      expect(decoded.width).toBe(1);
      expect(decoded.height).toBe(1);
      expect(decoded.sourceData.bytes.buffer).toBe(decodedPixels.buffer);
      expect(Array.from(decoded.sourceData.bytes)).toEqual([9, 18, 27, 255]);
      expect(decoded.sourceData.bytesPerRow).toBe(4);
      expect(decoded.sourceData.rowsPerImage).toBe(1);
      expect(bitmapClosed).toBe(true);
    } finally {
      if (previousCreateImageBitmap === undefined) {
        Reflect.deleteProperty(globals, "createImageBitmap");
      } else {
        globals.createImageBitmap = previousCreateImageBitmap;
      }

      if (previousOffscreenCanvas === undefined) {
        Reflect.deleteProperty(globals, "OffscreenCanvas");
      } else {
        globals.OffscreenCanvas = previousOffscreenCanvas;
      }
    }
  });
});
