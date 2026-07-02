import { expect, test } from "@playwright/test";

import {
  pixelDistance,
  readPngPixel,
  rgbaColorToPixel,
  type RgbaPixel,
} from "./png.js";
import {
  attachExampleStatus,
  attachWebGpuValidationConsoleGuard,
  expectStatusJsonSafeForGpu,
  skipIfUnsupportedWebGpu,
  waitForExampleStatus,
  waitForPresentedFrames,
} from "./webgpu-status.js";
import type { ExampleStatusBase } from "./example-status-types.js";

interface IridescenceStatus extends ExampleStatusBase {
  readonly iridescence?: {
    readonly meshKey: string;
    readonly textureMeshKey: string;
    readonly baseMaterialKey: string;
    readonly filmMaterialKey: string;
    readonly texturedFilmMaterialKey: string;
    readonly thicknessTexturedFilmMaterialKey: string;
    readonly iridescenceTextureKey: string;
    readonly iridescenceThicknessTextureKey: string;
    readonly iridescenceSamplerKey: string;
    readonly iridescenceFactor: number;
    readonly iridescenceIor: number;
    readonly iridescenceThicknessMinimum: number;
    readonly iridescenceThicknessMaximum: number;
    readonly textureBackedFactor: boolean;
    readonly textureBackedThickness: boolean;
    readonly textureContrast?: {
      readonly ok: boolean;
      readonly highLowDistance: number;
      readonly lowLuminance: number;
      readonly highLuminance: number;
    } | null;
    readonly thicknessContrast?: {
      readonly ok: boolean;
      readonly highLowDistance: number;
      readonly lowLuminance: number;
      readonly highLuminance: number;
    } | null;
  };
  readonly frame?: IridescenceFrameStatus;
}

interface IridescenceFrameStatus {
  readonly snapshot?: {
    readonly views: number;
    readonly meshDraws: number;
    readonly lights: number;
    readonly diagnostics: number;
  };
  readonly counts?: {
    readonly meshDraws: number;
    readonly drawCalls: number;
    readonly diagnostics: number;
  };
  readonly pipelineKeys?: readonly string[];
  readonly readback?: {
    readonly ok: boolean;
    readonly reason?: string;
    readonly samples?: readonly {
      readonly id: string;
      readonly pixel: {
        readonly r: number;
        readonly g: number;
        readonly b: number;
        readonly a: number;
      };
    }[];
  };
}

test("browser renders scalar iridescence with a distinct thin-film color shift", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/iridescence.html");

  const status = await waitForExampleStatus<IridescenceStatus>(page);

  await attachExampleStatus("iridescence-status", status);
  expect(status, "iridescence status should publish").toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "iridescence",
    ok: true,
    phase: "submit",
    renderingBackend: "webgpu-explicit",
    canvas: {
      width: 960,
      height: 960,
    },
    iridescence: {
      meshKey: "mesh:iridescence-panel-mesh",
      textureMeshKey: "mesh:iridescence-texture-panel-mesh",
      baseMaterialKey: "material:iridescence-base-material",
      filmMaterialKey: "material:iridescence-film-material",
      texturedFilmMaterialKey: "material:iridescence-textured-film-material",
      thicknessTexturedFilmMaterialKey:
        "material:iridescence-thickness-textured-film-material",
      iridescenceTextureKey: "texture:iridescence-factor-texture",
      iridescenceThicknessTextureKey:
        "texture:iridescence-thickness-factor-texture",
      iridescenceSamplerKey: "sampler:iridescence-factor-nearest",
      iridescenceFactor: 1,
      iridescenceIor: 1.3,
      iridescenceThicknessMinimum: 120,
      iridescenceThicknessMaximum: 560,
      textureBackedFactor: true,
      textureBackedThickness: true,
      textureContrast: {
        ok: true,
      },
      thicknessContrast: {
        ok: true,
      },
    },
    frame: {
      snapshot: {
        views: 1,
        meshDraws: 4,
        lights: 2,
        diagnostics: 0,
      },
      counts: {
        meshDraws: 4,
        diagnostics: 0,
      },
    },
  });

  const frame = status.frame;

  expect(frame, JSON.stringify(status, null, 2)).toBeDefined();

  if (frame === undefined) {
    return;
  }

  expect(frame.counts?.drawCalls).toBeGreaterThanOrEqual(1);
  expect(frame.pipelineKeys).toEqual(
    expect.arrayContaining([
      "standard|opaque|none|less|none",
      "standard|iridescence|opaque|none|less|none",
      "standard|iridescence|iridescenceTexture|opaque|none|less|none",
      "standard|iridescence|iridescenceThicknessTexture|opaque|none|less|none",
    ]),
  );

  await waitForPresentedFrames(page);
  const screenshot = await page.locator("#aperture-canvas").screenshot();
  await test.info().attach("iridescence-canvas", {
    body: screenshot,
    contentType: "image/png",
  });

  assertIridescenceScreenshot(screenshot);
  webGpuValidation.expectNoWarnings();
  await page.close({ runBeforeUnload: false });
});

/**
 * Sample a small normalized-coordinate patch instead of one hardcoded pixel:
 * a single-pixel probe flips on a one-pixel layout shift (fractional CSS
 * rounding of the canvas) or anti-aliasing variance at a panel edge.
 */
function regionPixels(
  screenshot: Buffer,
  centerX: number,
  centerY: number,
): readonly RgbaPixel[] {
  const pixels: RgbaPixel[] = [];

  for (let dy = -2; dy <= 2; dy += 1) {
    for (let dx = -2; dx <= 2; dx += 1) {
      pixels.push(
        readPngPixel(screenshot, centerX + dx * 0.01, centerY + dy * 0.01),
      );
    }
  }

  return pixels;
}

function regionAverage(
  screenshot: Buffer,
  centerX: number,
  centerY: number,
): RgbaPixel {
  const pixels = regionPixels(screenshot, centerX, centerY);
  const sum = { r: 0, g: 0, b: 0, a: 0 };

  for (const pixel of pixels) {
    sum.r += pixel.r;
    sum.g += pixel.g;
    sum.b += pixel.b;
    sum.a += pixel.a;
  }

  return {
    r: sum.r / pixels.length,
    g: sum.g / pixels.length,
    b: sum.b / pixels.length,
    a: sum.a / pixels.length,
  };
}

function regionMaxDistance(
  screenshot: Buffer,
  centerX: number,
  centerY: number,
  reference: RgbaPixel,
): number {
  return Math.max(
    ...regionPixels(screenshot, centerX, centerY).map((pixel) =>
      pixelDistance(pixel, reference),
    ),
  );
}

function assertIridescenceScreenshot(screenshot: Buffer): void {
  const clear = rgbaColorToPixel({ r: 0.015, g: 0.017, b: 0.021, a: 1 });
  const basePanel = regionAverage(screenshot, 0.25, 0.5);
  const filmPanel = regionAverage(screenshot, 0.625, 0.5);
  const textureLow = regionAverage(screenshot, 0.38, 0.78);
  const textureHigh = regionAverage(screenshot, 0.66, 0.78);
  const thicknessLow = regionAverage(screenshot, 0.38, 0.92);
  const thicknessHigh = regionAverage(screenshot, 0.66, 0.92);

  // "Panel is visible": the strongest pixel in the patch clears the
  // threshold, so a one-pixel drift cannot flip the probe.
  expect(regionMaxDistance(screenshot, 0.25, 0.5, clear)).toBeGreaterThan(24);
  expect(regionMaxDistance(screenshot, 0.625, 0.5, clear)).toBeGreaterThan(24);
  expect(regionMaxDistance(screenshot, 0.38, 0.78, clear)).toBeGreaterThan(18);
  expect(regionMaxDistance(screenshot, 0.66, 0.78, clear)).toBeGreaterThan(18);
  expect(regionMaxDistance(screenshot, 0.38, 0.92, clear)).toBeGreaterThan(18);
  expect(regionMaxDistance(screenshot, 0.66, 0.92, clear)).toBeGreaterThan(18);
  // Background: every pixel in the patch stays near the clear color.
  expect(regionMaxDistance(screenshot, 0.5, 0.12, clear)).toBeLessThan(12);
  // Cross-panel color relations compare patch AVERAGES, which are stable to
  // sub-pixel layout shifts and per-pixel AA noise.
  expect(pixelDistance(filmPanel, basePanel)).toBeGreaterThan(70);
  expect(pixelDistance(textureHigh, textureLow)).toBeGreaterThan(24);
  expect(pixelDistance(thicknessHigh, thicknessLow)).toBeGreaterThan(18);
  expect(filmPanel.g).toBeGreaterThan(filmPanel.r + 25);
  expect(filmPanel.b).toBeGreaterThan(filmPanel.r + 25);
}
