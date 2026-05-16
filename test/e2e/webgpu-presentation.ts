import type { Locator } from "@playwright/test";

import { pixelDistance, readPngPixel, type RgbaPixel } from "./png.js";

const cssBackgroundTolerance = 6;

export interface CanvasPresentationSample {
  readonly centerPixel: RgbaPixel;
  readonly cssBackgroundPixel: RgbaPixel | null;
  readonly distanceFromCssBackground: number | null;
  readonly samplesCssBackground: boolean;
  readonly diagnostic: string;
}

export async function sampleCanvasCenterPresentation(
  canvas: Locator,
): Promise<CanvasPresentationSample> {
  const [screenshot, cssBackground] = await Promise.all([
    canvas.screenshot(),
    canvas.evaluate((element) => getComputedStyle(element).backgroundColor),
  ]);
  const centerPixel = readPngPixel(screenshot, 0.5, 0.5);
  const cssBackgroundPixel = parseCssColor(cssBackground);
  const distanceFromCssBackground =
    cssBackgroundPixel === null
      ? null
      : pixelDistance(centerPixel, cssBackgroundPixel);
  const samplesCssBackground =
    distanceFromCssBackground !== null &&
    distanceFromCssBackground <= cssBackgroundTolerance;

  return {
    centerPixel,
    cssBackgroundPixel,
    distanceFromCssBackground,
    samplesCssBackground,
    diagnostic: createDiagnostic({
      centerPixel,
      cssBackground,
      cssBackgroundPixel,
      distanceFromCssBackground,
    }),
  };
}

function createDiagnostic(input: {
  readonly centerPixel: RgbaPixel;
  readonly cssBackground: string;
  readonly cssBackgroundPixel: RgbaPixel | null;
  readonly distanceFromCssBackground: number | null;
}): string {
  if (input.cssBackgroundPixel === null) {
    return `Headless Chromium screenshot did not provide a parseable canvas CSS background; center pixel was ${formatPixel(
      input.centerPixel,
    )} and computed background was '${input.cssBackground}'.`;
  }

  return `Headless Chromium screenshot did not expose WebGPU-presented canvas pixels; sampled center pixel ${formatPixel(
    input.centerPixel,
  )} matches computed CSS canvas background ${formatPixel(
    input.cssBackgroundPixel,
  )} within ${cssBackgroundTolerance} channels (distance ${input.distanceFromCssBackground?.toFixed(
    2,
  )}).`;
}

function parseCssColor(value: string): RgbaPixel | null {
  const trimmed = value.trim();
  const commaMatch = trimmed.match(
    /^rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)(?:\s*,\s*([0-9.]+%?))?\s*\)$/i,
  );
  const spaceMatch = trimmed.match(
    /^rgba?\(\s*([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)(?:\s*\/\s*([0-9.]+%?))?\s*\)$/i,
  );
  const match = commaMatch ?? spaceMatch;

  if (match === null) {
    return null;
  }

  return {
    r: cssChannelToByte(match[1]),
    g: cssChannelToByte(match[2]),
    b: cssChannelToByte(match[3]),
    a: cssAlphaToByte(match[4]),
  };
}

function cssChannelToByte(value: string | undefined): number {
  return clampByte(Math.round(Number(value ?? 0)));
}

function cssAlphaToByte(value: string | undefined): number {
  if (value === undefined) {
    return 255;
  }

  if (value.endsWith("%")) {
    return clampByte(Math.round((Number(value.slice(0, -1)) / 100) * 255));
  }

  return clampByte(Math.round(Number(value) * 255));
}

function clampByte(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(255, Math.max(0, value));
}

function formatPixel(pixel: RgbaPixel): string {
  return `rgba(${pixel.r}, ${pixel.g}, ${pixel.b}, ${pixel.a})`;
}
