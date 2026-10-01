import { afterEach, describe, expect, it, vi } from "vitest";
import { readGeneratedCanvasSamples } from "../../packages/app/src/browser/devtools/canvas-readback.js";
import {
  canvasDimensions,
  pixelFromSample,
  pixelSampleRequestsFromPayload,
} from "../../packages/app/src/browser/devtools/payloads.js";

class FakeCanvas {
  width = 5;
  height = 3;
}

function installReadback() {
  const canvas = new FakeCanvas();
  const bitmap = { width: 5, height: 3, close: vi.fn() };
  const context = {
    drawImage: vi.fn(),
    getImageData: vi.fn((x: number, y: number) => ({
      data: new Uint8ClampedArray([x * 10, y * 20, 100, 255]),
    })),
  };
  const readback = {
    width: 0,
    height: 0,
    getContext: vi.fn(() => context as typeof context | null),
  };
  const document = {
    querySelector: vi.fn(() => canvas as FakeCanvas | null),
    createElement: vi.fn(() => readback),
  };
  const createImageBitmap = vi.fn(async () => bitmap);
  vi.stubGlobal("HTMLCanvasElement", FakeCanvas);
  vi.stubGlobal("document", document);
  vi.stubGlobal("createImageBitmap", createImageBitmap);
  vi.stubGlobal("OffscreenCanvas", undefined);
  return { canvas, bitmap, context, readback, document, createImageBitmap };
}

afterEach(() => vi.unstubAllGlobals());

describe("managed browser readback payloads", () => {
  it("normalizes invalid sample fields to a finite center request", () => {
    for (const payload of [null, undefined, 12, {}, { samples: [] }]) {
      expect(pixelSampleRequestsFromPayload(payload)).toEqual([
        { id: "sample-1", x: 0.5, y: 0.5, coordinateSpace: "auto" },
      ]);
    }
    expect(
      pixelSampleRequestsFromPayload({
        samples: [
          null,
          { id: "", x: NaN, y: Infinity, coordinateSpace: "wrong" },
          { id: "edge", x: 1, y: 0, coordinateSpace: "normalized" },
          { id: "pixel", x: 3, y: 2, coordinateSpace: "pixel" },
        ],
      }),
    ).toEqual([
      { id: "sample-1", x: 0.5, y: 0.5, coordinateSpace: "auto" },
      { id: "sample-2", x: 0.5, y: 0.5, coordinateSpace: "auto" },
      { id: "edge", x: 1, y: 0, coordinateSpace: "normalized" },
      { id: "pixel", x: 3, y: 2, coordinateSpace: "pixel" },
    ]);
  });

  it("maps normalized coordinates to inclusive pixel edges and floors pixel coordinates", () => {
    const dimensions = { width: 5, height: 3 };
    expect(
      pixelFromSample(dimensions, {
        id: "edge",
        x: 2,
        y: -1,
        coordinateSpace: "normalized",
      }),
    ).toEqual({ x: 4, y: 0 });
    expect(
      pixelFromSample(dimensions, {
        id: "pixel",
        x: 3.9,
        y: 1.8,
        coordinateSpace: "auto",
      }),
    ).toEqual({ x: 3, y: 1 });
    expect(
      pixelFromSample(dimensions, {
        id: "center",
        x: 0.5,
        y: 0.5,
        coordinateSpace: "auto",
      }),
    ).toEqual({ x: 2, y: 1 });
    for (const [x, y] of [
      [-1, 0],
      [0, -1],
      [5, 0],
      [0, 3],
    ]) {
      expect(
        pixelFromSample(dimensions, {
          id: "outside",
          x: x!,
          y: y!,
          coordinateSpace: "pixel",
        }),
      ).toBeNull();
    }
    expect(canvasDimensions({ width: 5.9, height: 0 })).toEqual({
      width: 5,
      height: 1,
    });
  });
});

describe("managed browser canvas readback", () => {
  it("returns actionable diagnostics without allocating a bitmap when canvas or bitmap support is absent", async () => {
    const fixture = installReadback();
    fixture.document.querySelector.mockReturnValue(null);
    expect(await readGeneratedCanvasSamples({})).toMatchObject({
      ok: false,
      width: 0,
      height: 0,
      samples: [],
      diagnostics: [{ code: "aperture.render.canvasMissing" }],
    });
    expect(fixture.createImageBitmap).not.toHaveBeenCalled();
    fixture.document.querySelector.mockReturnValue(fixture.canvas);
    vi.stubGlobal("createImageBitmap", undefined);
    expect(await readGeneratedCanvasSamples({})).toMatchObject({
      ok: false,
      diagnostics: [{ code: "aperture.render.createImageBitmapMissing" }],
    });
  });

  it("reads normalized, automatic and pixel samples and closes the bitmap once", async () => {
    const fixture = installReadback();
    const result = await readGeneratedCanvasSamples({
      samples: [
        { id: "first", x: 0, y: 0, coordinateSpace: "normalized" },
        { id: "last", x: 1, y: 1, coordinateSpace: "normalized" },
        { id: "middle", x: 2.9, y: 1.2, coordinateSpace: "pixel" },
      ],
    });
    expect(result).toEqual({
      ok: true,
      width: 5,
      height: 3,
      samples: [
        { id: "first", x: 0, y: 0, pixel: { r: 0, g: 0, b: 100, a: 255 } },
        { id: "last", x: 4, y: 2, pixel: { r: 40, g: 40, b: 100, a: 255 } },
        { id: "middle", x: 2, y: 1, pixel: { r: 20, g: 20, b: 100, a: 255 } },
      ],
      diagnostics: [],
    });
    expect(fixture.createImageBitmap).toHaveBeenCalledWith(fixture.canvas);
    expect(fixture.document.createElement).toHaveBeenCalledWith("canvas");
    expect(fixture.readback).toMatchObject({ width: 5, height: 3 });
    expect(fixture.readback.getContext).toHaveBeenCalledWith("2d", {
      willReadFrequently: true,
    });
    expect(fixture.context.drawImage).toHaveBeenCalledWith(
      fixture.bitmap,
      0,
      0,
    );
    expect(fixture.bitmap.close).toHaveBeenCalledOnce();
  });

  it("preserves valid samples alongside out-of-bounds diagnostics, but skips wholly invalid requests", async () => {
    const fixture = installReadback();
    const invalid = { id: "outside", x: 5, y: 1, coordinateSpace: "pixel" };
    const mixed = await readGeneratedCanvasSamples({
      samples: [{ id: "center" }, invalid],
    });
    expect(mixed).toMatchObject({
      ok: false,
      width: 5,
      height: 3,
      samples: [{ id: "center", x: 2, y: 1 }],
      diagnostics: [
        { code: "aperture.render.readbackSampleOutOfBounds", data: invalid },
      ],
    });
    expect(fixture.bitmap.close).toHaveBeenCalledOnce();
    fixture.createImageBitmap.mockClear();
    expect(await readGeneratedCanvasSamples(invalid)).toMatchObject({
      ok: false,
      width: 5,
      height: 3,
      samples: [],
      diagnostics: [{ code: "aperture.render.readbackSampleOutOfBounds" }],
    });
    expect(fixture.createImageBitmap).not.toHaveBeenCalled();
  });

  it("uses OffscreenCanvas when available instead of a DOM canvas", async () => {
    const fixture = installReadback();
    const constructed = vi.fn();
    class FakeOffscreenCanvas {
      getContext = fixture.readback.getContext;
      constructor(
        public width: number,
        public height: number,
      ) {
        constructed(width, height);
      }
    }
    vi.stubGlobal("OffscreenCanvas", FakeOffscreenCanvas);
    expect((await readGeneratedCanvasSamples({})).ok).toBe(true);
    expect(constructed).toHaveBeenCalledWith(5, 3);
    expect(fixture.document.createElement).not.toHaveBeenCalled();
    expect(fixture.bitmap.close).toHaveBeenCalledOnce();
  });

  it("closes acquired bitmaps when a 2D context is unavailable", async () => {
    const fixture = installReadback();
    fixture.readback.getContext.mockReturnValue(null);
    expect(await readGeneratedCanvasSamples({})).toMatchObject({
      ok: false,
      width: 5,
      height: 3,
      diagnostics: [{ code: "aperture.render.readbackContextMissing" }],
    });
    expect(fixture.bitmap.close).toHaveBeenCalledOnce();
    expect(fixture.context.drawImage).not.toHaveBeenCalled();
  });

  it("closes acquired bitmaps and reports readback exceptions", async () => {
    const fixture = installReadback();
    fixture.context.getImageData.mockImplementation(() => {
      throw new Error("Canvas is tainted");
    });
    expect(await readGeneratedCanvasSamples({})).toMatchObject({
      ok: false,
      samples: [],
      diagnostics: [
        {
          code: "aperture.render.readbackFailed",
          message: "Canvas is tainted",
        },
      ],
    });
    expect(fixture.bitmap.close).toHaveBeenCalledOnce();
  });

  it("reports non-Error bitmap rejection without closing an unacquired bitmap", async () => {
    const fixture = installReadback();
    fixture.createImageBitmap.mockRejectedValue("capture unavailable");
    expect(await readGeneratedCanvasSamples({})).toMatchObject({
      ok: false,
      diagnostics: [
        {
          code: "aperture.render.readbackFailed",
          message: "capture unavailable",
        },
      ],
    });
    expect(fixture.bitmap.close).not.toHaveBeenCalled();
  });
});
