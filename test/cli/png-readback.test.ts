import { Buffer } from "node:buffer";
import { deflateSync } from "node:zlib";
import { describe, expect, it, vi } from "vitest";

import { callBrowserBackedTool } from "../../packages/cli/src/tools/dispatch.js";

describe("Aperture CLI PNG readback tools", () => {
  it("samples the canvas region from browser screenshots", async () => {
    const screenshot = createRgbPng(4, 4, [
      [255, 0, 0],
      [0, 255, 0],
      [0, 0, 255],
      [255, 255, 255],
      [10, 0, 0],
      [20, 0, 0],
      [30, 0, 0],
      [40, 0, 0],
      [50, 0, 0],
      [60, 0, 0],
      [70, 0, 0],
      [80, 0, 0],
      [90, 0, 0],
      [100, 0, 0],
      [110, 0, 0],
      [120, 0, 0],
    ]);
    const page = {
      screenshot: vi.fn(async () => screenshot),
      evaluate: vi.fn(async () => ({
        left: 1,
        top: 1,
        width: 2,
        height: 2,
        viewportWidth: 4,
        viewportHeight: 4,
      })),
    };
    const session = {} as Parameters<typeof callBrowserBackedTool>[1];

    await expect(
      callBrowserBackedTool(
        page as unknown as Parameters<typeof callBrowserBackedTool>[0],
        session,
        "render_readback_samples",
        {
          samples: [
            { id: "canvas-top-left", x: 0, y: 0, coordinateSpace: "pixel" },
            {
              id: "canvas-bottom-right",
              x: 1,
              y: 1,
              coordinateSpace: "normalized",
            },
          ],
        },
      ),
    ).resolves.toMatchObject({
      ok: true,
      source: "screenshot",
      width: 2,
      height: 2,
      region: {
        source: "canvas",
        left: 1,
        top: 1,
        width: 2,
        height: 2,
        screenshotWidth: 4,
        screenshotHeight: 4,
      },
      samples: [
        {
          id: "canvas-top-left",
          x: 0,
          y: 0,
          screenshotX: 1,
          screenshotY: 1,
          pixel: { r: 20, g: 0, b: 0, a: 255 },
        },
        {
          id: "canvas-bottom-right",
          x: 1,
          y: 1,
          screenshotX: 2,
          screenshotY: 2,
          pixel: { r: 70, g: 0, b: 0, a: 255 },
        },
      ],
    });

    await expect(
      callBrowserBackedTool(
        page as unknown as Parameters<typeof callBrowserBackedTool>[0],
        session,
        "browser_pick_pixel",
        { x: 1, y: 1, coordinateSpace: "normalized" },
      ),
    ).resolves.toMatchObject({
      ok: true,
      result: {
        sample: {
          pixel: { r: 70, g: 0, b: 0, a: 255 },
        },
      },
    });
    expect(page.screenshot).toHaveBeenCalledWith({ type: "png" });
    expect(page.evaluate).toHaveBeenCalledTimes(2);
  });

  it("falls back to whole-screenshot samples when no canvas exists", async () => {
    const screenshot = createRgbPng(2, 2, [
      [255, 0, 0],
      [0, 255, 0],
      [0, 0, 255],
      [255, 255, 255],
    ]);
    const page = {
      screenshot: vi.fn(async () => screenshot),
      evaluate: vi.fn(async () => null),
    };
    const session = {} as Parameters<typeof callBrowserBackedTool>[1];

    await expect(
      callBrowserBackedTool(
        page as unknown as Parameters<typeof callBrowserBackedTool>[0],
        session,
        "render_readback_samples",
        {
          samples: [
            { id: "top-left", x: 0, y: 0, coordinateSpace: "pixel" },
            { id: "bottom-right", x: 1, y: 1, coordinateSpace: "pixel" },
          ],
        },
      ),
    ).resolves.toMatchObject({
      ok: true,
      source: "screenshot",
      width: 2,
      height: 2,
      region: {
        source: "screenshot",
        left: 0,
        top: 0,
        width: 2,
        height: 2,
      },
      samples: [
        {
          id: "top-left",
          pixel: { r: 255, g: 0, b: 0, a: 255 },
        },
        {
          id: "bottom-right",
          pixel: { r: 255, g: 255, b: 255, a: 255 },
        },
      ],
    });
  });
});

function createRgbPng(
  width: number,
  height: number,
  pixels: readonly (readonly [number, number, number])[],
): Buffer {
  const bytesPerPixel = 3;
  const rowBytes = width * bytesPerPixel;
  const rawRows = Buffer.alloc((rowBytes + 1) * height);

  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * (rowBytes + 1);
    rawRows[rowOffset] = 0;
    for (let x = 0; x < width; x += 1) {
      const pixel = pixels[y * width + x] ?? [0, 0, 0];
      const offset = rowOffset + 1 + x * bytesPerPixel;
      rawRows[offset] = pixel[0];
      rawRows[offset + 1] = pixel[1];
      rawRows[offset + 2] = pixel[2];
    }
  }

  return Buffer.concat([
    Buffer.from("89504e470d0a1a0a", "hex"),
    pngChunk(
      "IHDR",
      Buffer.from([...uint32(width), ...uint32(height), 8, 2, 0, 0, 0]),
    ),
    pngChunk("IDAT", deflateSync(rawRows)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function pngChunk(type: string, data: Buffer): Buffer {
  const typeBytes = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])));
  return Buffer.concat([length, typeBytes, data, crc]);
}

function uint32(value: number): readonly number[] {
  return [
    (value >>> 24) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 8) & 0xff,
    value & 0xff,
  ];
}

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
