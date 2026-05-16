import { expect } from "@playwright/test";
import { inflateSync } from "node:zlib";

export interface RgbaPixel {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
}

export interface RgbaColor {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
}

export function expectChannelClose(
  label: string,
  actual: number,
  expected: number,
  tolerance = 12,
): void {
  expect(
    Math.abs(actual - expected),
    `${label} channel expected ${expected} +/- ${tolerance}, got ${actual}`,
  ).toBeLessThanOrEqual(tolerance);
}

export function colorChannelToByte(value: number): number {
  return Math.round(value * 255);
}

export function rgbaColorToPixel(color: RgbaColor): RgbaPixel {
  return {
    r: colorChannelToByte(color.r),
    g: colorChannelToByte(color.g),
    b: colorChannelToByte(color.b),
    a: colorChannelToByte(color.a),
  };
}

export function pixelDistance(a: RgbaPixel, b: RgbaPixel): number {
  return Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b, a.a - b.a);
}

export function readPngPixel(
  png: Buffer,
  xRatio: number,
  yRatio: number,
): RgbaPixel {
  if (png.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") {
    throw new Error("Screenshot is not a PNG.");
  }

  const idatChunks: Buffer[] = [];
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;

  while (offset < png.length) {
    const chunkLength = png.readUInt32BE(offset);
    offset += 4;

    const chunkType = png.subarray(offset, offset + 4).toString("ascii");
    offset += 4;

    const chunkData = png.subarray(offset, offset + chunkLength);
    offset += chunkLength + 4;

    if (chunkType === "IHDR") {
      width = chunkData.readUInt32BE(0);
      height = chunkData.readUInt32BE(4);
      bitDepth = chunkData[8] ?? 0;
      colorType = chunkData[9] ?? 0;
    } else if (chunkType === "IDAT") {
      idatChunks.push(chunkData);
    } else if (chunkType === "IEND") {
      break;
    }
  }

  if (width <= 0 || height <= 0 || idatChunks.length === 0) {
    throw new Error("PNG screenshot is missing image data.");
  }

  if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6)) {
    throw new Error(
      `Unsupported PNG screenshot format: bitDepth=${bitDepth}, colorType=${colorType}.`,
    );
  }

  const bytesPerPixel = colorType === 6 ? 4 : 3;
  const pixels = unfilterPngScanlines(
    inflateSync(Buffer.concat(idatChunks)),
    width,
    height,
    bytesPerPixel,
  );
  const x = clampIndex(Math.floor(width * xRatio), width);
  const y = clampIndex(Math.floor(height * yRatio), height);
  const pixelOffset = (y * width + x) * bytesPerPixel;

  return {
    r: pixels[pixelOffset] ?? 0,
    g: pixels[pixelOffset + 1] ?? 0,
    b: pixels[pixelOffset + 2] ?? 0,
    a: colorType === 6 ? (pixels[pixelOffset + 3] ?? 0) : 255,
  };
}

function unfilterPngScanlines(
  data: Buffer,
  width: number,
  height: number,
  bytesPerPixel: number,
): Uint8Array {
  const rowBytes = width * bytesPerPixel;
  const pixels = new Uint8Array(rowBytes * height);
  let sourceOffset = 0;

  for (let y = 0; y < height; y += 1) {
    const filter = data[sourceOffset] ?? -1;
    sourceOffset += 1;
    const rowOffset = y * rowBytes;

    for (let x = 0; x < rowBytes; x += 1) {
      const raw = data[sourceOffset] ?? 0;
      sourceOffset += 1;

      const left =
        x >= bytesPerPixel ? (pixels[rowOffset + x - bytesPerPixel] ?? 0) : 0;
      const up = y > 0 ? (pixels[rowOffset - rowBytes + x] ?? 0) : 0;
      const upLeft =
        y > 0 && x >= bytesPerPixel
          ? (pixels[rowOffset - rowBytes + x - bytesPerPixel] ?? 0)
          : 0;

      pixels[rowOffset + x] =
        (raw + reconstructedPngByte(filter, left, up, upLeft)) & 0xff;
    }
  }

  return pixels;
}

function reconstructedPngByte(
  filter: number,
  left: number,
  up: number,
  upLeft: number,
): number {
  switch (filter) {
    case 0:
      return 0;
    case 1:
      return left;
    case 2:
      return up;
    case 3:
      return Math.floor((left + up) / 2);
    case 4:
      return paethPredictor(left, up, upLeft);
    default:
      throw new Error(`Unsupported PNG filter: ${filter}.`);
  }
}

function paethPredictor(left: number, up: number, upLeft: number): number {
  const estimate = left + up - upLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const upLeftDistance = Math.abs(estimate - upLeft);

  if (leftDistance <= upDistance && leftDistance <= upLeftDistance) {
    return left;
  }

  return upDistance <= upLeftDistance ? up : upLeft;
}

function clampIndex(index: number, size: number): number {
  return Math.min(size - 1, Math.max(0, index));
}
