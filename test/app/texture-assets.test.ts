import { describe, expect, it } from "vitest";

import { createApertureApp } from "@aperture-engine/app";
import { asset, defineApertureConfig } from "@aperture-engine/app/config";
import { createTextureHandle } from "@aperture-engine/simulation";
import type { TextureAsset } from "@aperture-engine/render";

describe("app texture asset config", () => {
  it("preloads image textures as decoded TextureAsset source data", async () => {
    const globals = globalThis as unknown as Record<string, unknown>;
    const previousCreateImageBitmap = globals.createImageBitmap;
    const previousOffscreenCanvas = globals.OffscreenCanvas;
    const decodedPixels = new Uint8ClampedArray([
      4, 8, 12, 255, 16, 20, 24, 128,
    ]);
    let bitmapClosed = false;

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

    globals.createImageBitmap = async (blob: Blob) => {
      expect(blob.type).toBe("image/png");
      return {
        width: 2,
        height: 1,
        close: () => {
          bitmapClosed = true;
        },
      };
    };
    globals.OffscreenCanvas = FakeOffscreenCanvas;

    try {
      const app = await createApertureApp({
        config: defineApertureConfig({
          mode: "headless",
          assets: {
            smoke: asset.texture("data:image/png;base64,AQIDBA==", {
              preload: "blocking",
              label: "Smoke sprite",
              colorSpace: "srgb",
              semantic: "base-color",
              mimeType: "image/png",
            }),
          },
        }),
      });

      const handle = app.context.assets.texture("smoke");
      expect(handle.ready.value).toBe(true);
      expect(handle.renderHandle).toEqual(createTextureHandle("smoke"));
      expect(handle.colorSpace).toBe("srgb");
      expect(handle.semantic).toBe("base-color");

      const entry = app.context.assetsRegistry.get<"texture", TextureAsset>(
        handle.renderHandle,
      );
      expect(entry?.status).toBe("ready");
      expect(entry?.asset?.kind).toBe("texture");
      expect(entry?.asset?.label).toBe("Smoke sprite");
      expect(entry?.asset?.width).toBe(2);
      expect(entry?.asset?.height).toBe(1);
      expect(entry?.asset?.format).toBe("rgba8unorm-srgb");
      expect(entry?.asset?.colorSpace).toBe("srgb");
      expect(entry?.asset?.semantic).toBe("base-color");
      expect(Array.from(entry?.asset?.sourceData?.bytes ?? [])).toEqual([
        4, 8, 12, 255, 16, 20, 24, 128,
      ]);
      expect(entry?.asset?.sourceData?.bytesPerRow).toBe(8);
      expect(entry?.asset?.sourceData?.rowsPerImage).toBe(1);
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
