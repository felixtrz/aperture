import { expect, test, type Locator } from "@playwright/test";

import { pixelDistance, readPngPixel, rgbaColorToPixel } from "./png.js";
import {
  attachExampleStatus,
  attachWebGpuValidationConsoleGuard,
  expectStatusJsonSafeForGpu,
  skipIfUnsupportedWebGpu,
  waitForExampleStatus,
} from "./webgpu-status.js";
import type { ExampleStatusBase } from "./example-status-types.js";

interface SheenStatus extends ExampleStatusBase {
  readonly sheen?: {
    readonly meshKey: string;
    readonly textureMeshKey: string;
    readonly baseMaterialKey: string;
    readonly fabricMaterialKey: string;
    readonly texturedFabricMaterialKey: string;
    readonly roughnessTexturedFabricMaterialKey: string;
    readonly sheenColorTextureKey: string;
    readonly sheenColorSamplerKey: string;
    readonly sheenRoughnessTextureKey: string;
    readonly sheenRoughnessSamplerKey: string;
    readonly sheenColorFactor: readonly [number, number, number];
    readonly sheenRoughnessFactor: number;
    readonly textureBackedColor: boolean;
    readonly textureBackedRoughness: boolean;
    readonly textureContrast?: {
      readonly ok: boolean;
      readonly highLowDistance?: number;
      readonly lowLuminance?: number;
      readonly highLuminance?: number;
      readonly reason?: string;
    } | null;
    readonly roughnessContrast?: {
      readonly ok: boolean;
      readonly highLowDistance?: number;
      readonly lowLuminance?: number;
      readonly highLuminance?: number;
      readonly reason?: string;
    } | null;
  };
  readonly frame?: SheenFrameStatus;
}

interface SheenFrameStatus {
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

test("browser renders scalar sheen with a distinct fabric rim response", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/sheen.html");

  const status = await waitForExampleStatus<SheenStatus>(page);

  await attachExampleStatus("sheen-status", status);
  expect(status, "sheen status should publish").toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "sheen",
    ok: true,
    phase: "submit",
    renderingBackend: "webgpu-explicit",
    canvas: {
      width: 960,
      height: 960,
    },
    sheen: {
      meshKey: "mesh:sheen-panel-mesh",
      textureMeshKey: "mesh:sheen-texture-panel-mesh",
      baseMaterialKey: "material:sheen-base-material",
      fabricMaterialKey: "material:sheen-fabric-material",
      texturedFabricMaterialKey: "material:sheen-textured-fabric-material",
      roughnessTexturedFabricMaterialKey:
        "material:sheen-roughness-textured-fabric-material",
      sheenColorTextureKey: "texture:sheen-color-factor-texture",
      sheenColorSamplerKey: "sampler:sheen-color-nearest",
      sheenRoughnessTextureKey: "texture:sheen-roughness-factor-texture",
      sheenRoughnessSamplerKey: "sampler:sheen-roughness-nearest",
      sheenColorFactor: [0.15, 1, 0.45],
      sheenRoughnessFactor: 1,
      textureBackedColor: true,
      textureBackedRoughness: true,
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
      "standard|sheen|opaque|none|less|none",
      "standard|sheen|sheenColorTexture|opaque|none|less|none",
      "standard|sheen|sheenRoughnessTexture|opaque|none|less|none",
    ]),
  );

  const screenshot = await waitForSheenScreenshot(
    page.locator("#aperture-canvas"),
  );
  await test.info().attach("sheen-canvas", {
    body: screenshot,
    contentType: "image/png",
  });

  assertSheenScreenshot(screenshot);
  webGpuValidation.expectNoWarnings();
  await page.close({ runBeforeUnload: false });
});

async function waitForSheenScreenshot(canvas: Locator): Promise<Buffer> {
  let screenshot = await canvas.screenshot();

  await expect
    .poll(
      async () => {
        screenshot = await canvas.screenshot();
        return sheenScreenshotFailure(screenshot);
      },
      {
        message: "sheen canvas should present rendered panel pixels",
        timeout: 5000,
      },
    )
    .toBeNull();

  return screenshot;
}

function assertSheenScreenshot(screenshot: Buffer): void {
  const failure = sheenScreenshotFailure(screenshot);

  expect(failure).toBeNull();
}

function sheenScreenshotFailure(screenshot: Buffer): string | null {
  const clear = rgbaColorToPixel({ r: 0.018, g: 0.02, b: 0.024, a: 1 });
  const basePanel = readPngPixel(screenshot, 0.34, 0.42);
  const sheenPanel = readPngPixel(screenshot, 0.77, 0.42);
  const textureLow = readPngPixel(screenshot, 0.3, 0.76);
  const textureHigh = readPngPixel(screenshot, 0.57, 0.76);
  const roughnessLow = readPngPixel(screenshot, 0.3, 0.92);
  const roughnessHigh = readPngPixel(screenshot, 0.57, 0.92);
  const background = readPngPixel(screenshot, 0.5, 0.12);

  if (pixelDistance(basePanel, clear) <= 45) {
    return `base panel did not render visibly: ${JSON.stringify({
      basePanel,
      clear,
    })}`;
  }

  if (pixelDistance(sheenPanel, clear) <= 45) {
    return `sheen panel did not render visibly: ${JSON.stringify({
      sheenPanel,
      clear,
    })}`;
  }

  if (pixelDistance(background, clear) >= 12) {
    return `background drifted from clear color: ${JSON.stringify({
      background,
      clear,
    })}`;
  }

  if (luminance(sheenPanel) <= luminance(basePanel) + 45) {
    return `scalar sheen panel is not brighter than base: ${JSON.stringify({
      basePanel,
      sheenPanel,
    })}`;
  }

  if (pixelDistance(textureHigh, textureLow) <= 75) {
    return `sheen color texture samples are not distinct: ${JSON.stringify({
      textureLow,
      textureHigh,
    })}`;
  }

  if (luminance(textureHigh) <= luminance(textureLow) + 45) {
    return `sheen color texture high sample is not brighter: ${JSON.stringify({
      textureLow,
      textureHigh,
    })}`;
  }

  if (textureHigh.g <= textureLow.g + 70) {
    return `sheen color texture green channel is not distinct: ${JSON.stringify(
      {
        textureLow,
        textureHigh,
      },
    )}`;
  }

  if (pixelDistance(roughnessHigh, roughnessLow) <= 18) {
    return `sheen roughness texture samples are not distinct: ${JSON.stringify({
      roughnessLow,
      roughnessHigh,
    })}`;
  }

  return null;
}

function luminance(pixel: {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}): number {
  return pixel.r * 0.2126 + pixel.g * 0.7152 + pixel.b * 0.0722;
}
