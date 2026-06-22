import { inflateSync } from "node:zlib";

export interface RgbaPixel {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
}

export interface PngReadbackSample {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly screenshotX: number;
  readonly screenshotY: number;
  readonly pixel: RgbaPixel;
}

export interface PngReadbackRegion {
  readonly source: "canvas" | "screenshot";
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly screenshotWidth: number;
  readonly screenshotHeight: number;
}

export interface PngReadbackResult {
  readonly ok: boolean;
  readonly source: "screenshot";
  readonly width: number;
  readonly height: number;
  readonly region: PngReadbackRegion;
  readonly samples: readonly PngReadbackSample[];
  readonly diagnostics: readonly unknown[];
}

export interface PngReadbackRegionInput {
  readonly source?: "canvas" | "screenshot";
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly viewportWidth?: number;
  readonly viewportHeight?: number;
}

export interface PngReadbackOptions {
  readonly region?: PngReadbackRegionInput | null;
}

interface PixelSampleRequest {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly coordinateSpace: "auto" | "normalized" | "pixel";
}

interface PngImage {
  readonly width: number;
  readonly height: number;
  readonly bytesPerPixel: number;
  readonly pixels: Uint8Array;
}

export function readPngSamples(
  png: Buffer,
  payload: unknown,
  options: PngReadbackOptions = {},
): PngReadbackResult {
  const image = readPngImage(png);
  const region = resolveReadbackRegion(image, options.region ?? null);
  const diagnostics: unknown[] = [];
  const samples = pixelSampleRequestsFromPayload(payload)
    .map((sample) => {
      const pixel = pixelFromSample(region, sample);
      if (pixel === null) {
        diagnostics.push({
          code: "aperture.render.readbackSampleOutOfBounds",
          severity: "error",
          message: `Readback sample '${sample.id}' is outside the ${region.width}x${region.height} ${region.source} readback region.`,
          data: sample,
        });
        return null;
      }

      const screenshotX = region.left + pixel.x;
      const screenshotY = region.top + pixel.y;

      return {
        id: sample.id,
        x: pixel.x,
        y: pixel.y,
        screenshotX,
        screenshotY,
        pixel: readImagePixel(image, screenshotX, screenshotY),
      };
    })
    .filter((sample): sample is PngReadbackSample => sample !== null);

  return {
    ok: diagnostics.length === 0 && samples.length > 0,
    source: "screenshot",
    width: region.width,
    height: region.height,
    region,
    samples,
    diagnostics,
  };
}

function pixelSampleRequestsFromPayload(
  payload: unknown,
): readonly PixelSampleRequest[] {
  const record = isRecord(payload) ? payload : {};
  const samples = Array.isArray(record["samples"]) ? record["samples"] : null;

  if (samples !== null && samples.length > 0) {
    return samples.map((sample, index) =>
      pixelSampleRequestFromValue(sample, index),
    );
  }

  return [pixelSampleRequestFromValue(record, 0)];
}

function pixelSampleRequestFromValue(
  value: unknown,
  index: number,
): PixelSampleRequest {
  const record = isRecord(value) ? value : {};
  const coordinateSpace = stringFromValue(record["coordinateSpace"]);

  return {
    id: stringFromValue(record["id"]) ?? `sample-${index + 1}`,
    x: numberFromValue(record["x"]) ?? 0.5,
    y: numberFromValue(record["y"]) ?? 0.5,
    coordinateSpace:
      coordinateSpace === "pixel" || coordinateSpace === "normalized"
        ? coordinateSpace
        : "auto",
  };
}

function pixelFromSample(
  dimensions: Pick<PngReadbackRegion, "width" | "height">,
  sample: PixelSampleRequest,
): { readonly x: number; readonly y: number } | null {
  const usePixelCoordinates =
    sample.coordinateSpace === "pixel" ||
    (sample.coordinateSpace === "auto" &&
      (Math.abs(sample.x) > 1 || Math.abs(sample.y) > 1));
  const x = usePixelCoordinates
    ? Math.floor(sample.x)
    : Math.round(clamp01(sample.x) * Math.max(0, dimensions.width - 1));
  const y = usePixelCoordinates
    ? Math.floor(sample.y)
    : Math.round(clamp01(sample.y) * Math.max(0, dimensions.height - 1));

  if (x < 0 || y < 0 || x >= dimensions.width || y >= dimensions.height) {
    return null;
  }

  return { x, y };
}

function resolveReadbackRegion(
  image: Pick<PngImage, "width" | "height">,
  input: PngReadbackRegionInput | null,
): PngReadbackRegion {
  if (input === null) {
    return {
      source: "screenshot",
      left: 0,
      top: 0,
      width: image.width,
      height: image.height,
      screenshotWidth: image.width,
      screenshotHeight: image.height,
    };
  }

  const viewportWidth = numberFromValue(input.viewportWidth) ?? image.width;
  const viewportHeight = numberFromValue(input.viewportHeight) ?? image.height;
  const scaleX = image.width / Math.max(1, viewportWidth);
  const scaleY = image.height / Math.max(1, viewportHeight);
  const left = Math.round(input.left * scaleX);
  const top = Math.round(input.top * scaleY);
  const right = Math.round((input.left + input.width) * scaleX);
  const bottom = Math.round((input.top + input.height) * scaleY);
  const clampedLeft = clampInt(left, 0, image.width);
  const clampedTop = clampInt(top, 0, image.height);
  const clampedRight = clampInt(right, clampedLeft, image.width);
  const clampedBottom = clampInt(bottom, clampedTop, image.height);
  const width = clampedRight - clampedLeft;
  const height = clampedBottom - clampedTop;

  if (width <= 0 || height <= 0) {
    return {
      source: "screenshot",
      left: 0,
      top: 0,
      width: image.width,
      height: image.height,
      screenshotWidth: image.width,
      screenshotHeight: image.height,
    };
  }

  return {
    source: input.source ?? "canvas",
    left: clampedLeft,
    top: clampedTop,
    width,
    height,
    screenshotWidth: image.width,
    screenshotHeight: image.height,
  };
}

function readPngImage(png: Buffer): PngImage {
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

  return {
    width,
    height,
    bytesPerPixel,
    pixels,
  };
}

function readImagePixel(image: PngImage, x: number, y: number): RgbaPixel {
  const pixelOffset = (y * image.width + x) * image.bytesPerPixel;

  return {
    r: image.pixels[pixelOffset] ?? 0,
    g: image.pixels[pixelOffset + 1] ?? 0,
    b: image.pixels[pixelOffset + 2] ?? 0,
    a: image.bytesPerPixel === 4 ? (image.pixels[pixelOffset + 3] ?? 0) : 255,
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

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function numberFromValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function stringFromValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
