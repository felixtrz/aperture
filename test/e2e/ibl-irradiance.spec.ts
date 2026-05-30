import { expect, test, type Page } from "@playwright/test";

import { pixelDistance } from "./png.js";
import {
  attachExampleStatus,
  expectStatusJsonSafeForGpu,
  skipIfUnsupportedWebGpu,
  waitForExampleStatus,
} from "./webgpu-status.js";
import type { ExampleStatusBase } from "./example-status-types.js";

type IrradianceMode = "convolved" | "raw";

interface RgbaPixel {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
}

interface IblIrradianceStatus extends ExampleStatusBase {
  readonly irradianceMode?: string;
  readonly clearColor?: RgbaPixel;
  readonly extraction?: {
    readonly meshDraws: number;
    readonly environments: number;
    readonly diagnostics: number;
  };
  readonly environment?: {
    readonly diffuse?: {
      readonly convolved: boolean;
      readonly ready: boolean;
      readonly faceSize: number;
    };
    readonly diagnosticCodes?: readonly string[];
  };
  readonly pipeline?: {
    readonly key: string | null;
    readonly cacheKey: string | null;
  };
  readonly readback?: {
    readonly ok: boolean;
    readonly reason?: string;
    readonly samples?: readonly {
      readonly id: string;
      readonly pixel: RgbaPixel;
    }[];
  };
}

interface IrradianceReadback {
  readonly status: IblIrradianceStatus;
  readonly bright: RgbaPixel;
  readonly dark: RgbaPixel;
}

test("ibl-irradiance convolves diffuse IBL into a softened irradiance map", async ({
  page,
}) => {
  const convolved = await loadIrradianceReadback(page, "convolved");

  // (Done-when #2) Status reports the convolution ran, and the diffuse pass
  // carries no submission-deferred diagnostic.
  expect(convolved.status.environment?.diffuse).toMatchObject({
    convolved: true,
    ready: true,
    faceSize: 32,
  });
  const codes = convolved.status.environment?.diagnosticCodes ?? [];
  expect(codes).not.toContain("iblPreparationPass.submissionDeferred");
  expect(codes).not.toContain(
    "iblTextureResource.diffuseIrradianceConvolutionDeferred",
  );
  expect(convolved.status.pipeline?.key ?? "").toContain("iblDiffuse");
  expectStatusJsonSafeForGpu(convolved.status);

  // (Done-when #1) Directional softening: the probe facing the bright
  // hemisphere is brighter than the probe facing the dark hemisphere, but the
  // dark-facing probe is non-trivially lit (hemisphere bleed), not black.
  const convolvedDirectional = pixelDistance(convolved.bright, convolved.dark);
  expect(
    convolvedDirectional,
    `convolved diffuse IBL should stay directional; bright=${JSON.stringify(
      convolved.bright,
    )} dark=${JSON.stringify(convolved.dark)}`,
  ).toBeGreaterThan(12);

  const raw = await loadIrradianceReadback(page, "raw");
  expect(raw.status.environment?.diffuse?.convolved).toBe(false);

  // (Done-when #1) The convolution SOFTENS the sharp per-face raw cube: the raw
  // directional contrast is far larger than the convolved contrast.
  const rawDirectional = pixelDistance(raw.bright, raw.dark);
  expect(
    rawDirectional,
    `raw verbatim cube should be sharply directional; bright=${JSON.stringify(
      raw.bright,
    )} dark=${JSON.stringify(raw.dark)}`,
  ).toBeGreaterThan(convolvedDirectional + 30);

  // (Done-when #1) Hemisphere bleed: the dark-facing probe is brightened by the
  // convolution relative to the raw cube (irradiance gathers from neighbours) —
  // a measurable convolved-vs-raw delta proving the convolution occurred.
  const bleedDelta = pixelDistance(convolved.dark, raw.dark);
  expect(
    bleedDelta,
    `convolution should bleed light into the dark-facing probe; convolvedDark=${JSON.stringify(
      convolved.dark,
    )} rawDark=${JSON.stringify(raw.dark)}`,
  ).toBeGreaterThan(20);
});

async function loadIrradianceReadback(
  page: Page,
  mode: IrradianceMode,
): Promise<IrradianceReadback> {
  await page.goto(`/examples/ibl-irradiance.html?mode=${mode}`);

  const initialStatus = await waitForExampleStatus<IblIrradianceStatus>(page);

  expect(
    initialStatus,
    `ibl-irradiance ${mode} status should publish`,
  ).toBeDefined();

  if (initialStatus === undefined) {
    throw new Error(`ibl-irradiance ${mode} status did not publish.`);
  }

  skipIfUnsupportedWebGpu(initialStatus);

  await page.waitForFunction((expected) => {
    const status = (
      globalThis as typeof globalThis & {
        readonly __APERTURE_EXAMPLE_STATUS__?: IblIrradianceStatus;
      }
    ).__APERTURE_EXAMPLE_STATUS__;

    if (
      status?.ok !== true ||
      status.irradianceMode !== expected ||
      status.readback?.ok !== true
    ) {
      return false;
    }

    const bright = status.readback.samples?.find(
      (s) => s.id === "bright-probe",
    );
    const dark = status.readback.samples?.find((s) => s.id === "dark-probe");

    if (bright === undefined || dark === undefined) {
      return false;
    }

    const clear = status.clearColor ?? { r: 4, g: 6, b: 9, a: 255 };
    const clearPixel = {
      r: Math.round(clear.r <= 1 ? clear.r * 255 : clear.r),
      g: Math.round(clear.g <= 1 ? clear.g * 255 : clear.g),
      b: Math.round(clear.b <= 1 ? clear.b * 255 : clear.b),
    };
    const onSphere = (pixel: { r: number; g: number; b: number }) =>
      Math.hypot(
        pixel.r - clearPixel.r,
        pixel.g - clearPixel.g,
        pixel.b - clearPixel.b,
      ) > 18;

    // Both probes must land on the lit sphere, not the cleared background.
    return onSphere(bright.pixel) && onSphere(dark.pixel);
  }, mode);

  const status = await waitForExampleStatus<IblIrradianceStatus>(page);

  if (status === undefined) {
    throw new Error(`ibl-irradiance ${mode} status disappeared.`);
  }

  await attachExampleStatus(`ibl-irradiance-${mode}`, status);
  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "ibl-irradiance",
    ok: true,
    irradianceMode: mode,
    extraction: { meshDraws: 1, diagnostics: 0 },
  });

  return {
    status,
    bright: findSample(status, "bright-probe"),
    dark: findSample(status, "dark-probe"),
  };
}

function findSample(status: IblIrradianceStatus, id: string): RgbaPixel {
  const sample = status.readback?.samples?.find((s) => s.id === id);

  if (sample === undefined) {
    throw new Error(
      `ibl-irradiance status is missing the ${id} readback sample.`,
    );
  }

  return sample.pixel;
}
