import { expect, test } from "@playwright/test";

import { pixelDistance, readPngPixel, rgbaColorToPixel } from "./png.js";
import {
  attachExampleStatus,
  attachWebGpuValidationConsoleGuard,
  expectStatusJsonSafeForGpu,
  skipIfUnsupportedWebGpu,
  waitForExampleStatus,
} from "./webgpu-status.js";
import type { ExampleStatusBase } from "./example-status-types.js";

interface IridescenceStatus extends ExampleStatusBase {
  readonly iridescence?: {
    readonly meshKey: string;
    readonly textureMeshKey: string;
    readonly baseMaterialKey: string;
    readonly filmMaterialKey: string;
    readonly texturedFilmMaterialKey: string;
    readonly iridescenceTextureKey: string;
    readonly iridescenceSamplerKey: string;
    readonly iridescenceFactor: number;
    readonly iridescenceIor: number;
    readonly iridescenceThicknessMinimum: number;
    readonly iridescenceThicknessMaximum: number;
    readonly textureBackedFactor: boolean;
    readonly textureContrast?: {
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
      iridescenceTextureKey: "texture:iridescence-factor-texture",
      iridescenceSamplerKey: "sampler:iridescence-factor-nearest",
      iridescenceFactor: 1,
      iridescenceIor: 1.3,
      iridescenceThicknessMinimum: 120,
      iridescenceThicknessMaximum: 560,
      textureBackedFactor: true,
      textureContrast: {
        ok: true,
      },
    },
    frame: {
      snapshot: {
        views: 1,
        meshDraws: 3,
        lights: 2,
        diagnostics: 0,
      },
      counts: {
        meshDraws: 3,
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
    ]),
  );

  await page.waitForTimeout(100);
  const screenshot = await page.locator("#aperture-canvas").screenshot();
  await test.info().attach("iridescence-canvas", {
    body: screenshot,
    contentType: "image/png",
  });

  assertIridescenceScreenshot(screenshot);
  webGpuValidation.expectNoWarnings();
  await page.close({ runBeforeUnload: false });
});

function assertIridescenceScreenshot(screenshot: Buffer): void {
  const clear = rgbaColorToPixel({ r: 0.015, g: 0.017, b: 0.021, a: 1 });
  const basePanel = readPngPixel(screenshot, 0.25, 0.5);
  const filmPanel = readPngPixel(screenshot, 0.625, 0.5);
  const textureLow = readPngPixel(screenshot, 0.38, 0.78);
  const textureHigh = readPngPixel(screenshot, 0.66, 0.78);
  const background = readPngPixel(screenshot, 0.5, 0.12);

  expect(pixelDistance(basePanel, clear)).toBeGreaterThan(24);
  expect(pixelDistance(filmPanel, clear)).toBeGreaterThan(24);
  expect(pixelDistance(textureLow, clear)).toBeGreaterThan(18);
  expect(pixelDistance(textureHigh, clear)).toBeGreaterThan(18);
  expect(pixelDistance(background, clear)).toBeLessThan(12);
  expect(pixelDistance(filmPanel, basePanel)).toBeGreaterThan(70);
  expect(pixelDistance(textureHigh, textureLow)).toBeGreaterThan(28);
  expect(filmPanel.g).toBeGreaterThan(filmPanel.r + 25);
  expect(filmPanel.b).toBeGreaterThan(filmPanel.r + 25);
}
