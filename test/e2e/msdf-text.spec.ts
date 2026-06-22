import { expect, test } from "@playwright/test";

import { pixelDistance, rgbaColorToPixel } from "./png.js";
import {
  attachExampleStatus,
  attachWebGpuValidationConsoleGuard,
  expectStatusJsonSafeForGpu,
  skipIfUnsupportedWebGpu,
  waitForExampleStatus,
} from "./webgpu-status.js";
import type { ExampleStatusBase } from "./example-status-types.js";

interface MsdfTextStatus extends ExampleStatusBase {
  readonly text?: {
    readonly textureKey: string;
    readonly samplerKey: string;
    readonly glyphCount: number;
    readonly batches: number;
    readonly proofs?: readonly unknown[];
  };
  readonly frames?: readonly MsdfTextFrameStatus[];
}

interface MsdfTextFrameStatus {
  readonly background: "dark" | "light";
  readonly snapshot?: {
    readonly views: number;
    readonly meshDraws: number;
    readonly spriteDraws: number;
    readonly quadInstances: number;
    readonly quadBatches: number;
    readonly diagnostics: number;
  };
  readonly counts?: {
    readonly spriteDraws: number;
    readonly quadInstances: number;
    readonly quadBatches: number;
    readonly drawCalls: number;
    readonly diagnostics: number;
  };
  readonly readback?: {
    readonly ok: boolean;
    readonly reason?: string;
    readonly message?: string;
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

test("browser renders worker-authored MSDF text quads", async ({ page }) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/msdf-text.html");

  const status = await waitForExampleStatus<MsdfTextStatus>(page);

  await attachExampleStatus("msdf-text-status", status);
  expect(status, "MSDF text status should publish").toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "msdf-text",
    ok: true,
    phase: "submit",
    renderingBackend: "webgpu-explicit",
    text: {
      textureKey: "texture:msdf-text-fixture-page-0",
      samplerKey: "sampler:msdf-text-linear",
      glyphCount: 6,
      batches: 2,
    },
  });
  expect(status.text?.proofs).toHaveLength(2);

  const dark = frameStatus(status, "dark");
  const light = frameStatus(status, "light");

  for (const frame of [dark, light]) {
    expect(frame, JSON.stringify(status, null, 2)).toMatchObject({
      snapshot: {
        views: 1,
        meshDraws: 0,
        spriteDraws: 0,
        quadInstances: 6,
        quadBatches: 2,
        diagnostics: 0,
      },
      counts: {
        spriteDraws: 0,
        quadInstances: 6,
        quadBatches: 2,
        drawCalls: 2,
        diagnostics: 0,
      },
    });
  }

  if (dark.readback?.ok !== true || light.readback?.ok !== true) {
    test.skip(
      true,
      `MSDF text pixel assertion requires readback: ${
        dark.readback?.reason ?? light.readback?.reason ?? "unknown"
      }`,
    );
  }

  assertTextOverDarkBackground(dark);
  assertTextOverLightBackground(light);
  webGpuValidation.expectNoWarnings();
});

function frameStatus(
  status: MsdfTextStatus,
  background: "dark" | "light",
): MsdfTextFrameStatus {
  const frame = status.frames?.find((entry) => entry.background === background);

  expect(frame, JSON.stringify(status, null, 2)).toBeDefined();

  return frame as MsdfTextFrameStatus;
}

function assertTextOverDarkBackground(frame: MsdfTextFrameStatus): void {
  const clear = rgbaColorToPixel({ r: 0.015, g: 0.022, b: 0.034, a: 1 });
  const samples = frame.readback?.samples ?? [];
  const background = requiredSample(samples, "background-upper-right");

  expect(pixelDistance(background.pixel, clear)).toBeLessThan(35);

  for (const id of ["large-a-fill", "large-v-fill", "small-e-fill"]) {
    const sample = requiredSample(samples, id);

    expect(
      pixelDistance(sample.pixel, clear),
      `expected dark-frame sample '${id}' to differ from the clear color`,
    ).toBeGreaterThan(45);
    expect(luminance(sample.pixel)).toBeGreaterThan(luminance(clear) + 45);
  }
}

function assertTextOverLightBackground(frame: MsdfTextFrameStatus): void {
  const clear = rgbaColorToPixel({ r: 0.88, g: 0.9, b: 0.84, a: 1 });
  const samples = frame.readback?.samples ?? [];
  const background = requiredSample(samples, "background-lower-right");

  expect(pixelDistance(background.pixel, clear)).toBeLessThan(35);

  for (const id of ["large-a-fill", "large-v-fill", "small-e-fill"]) {
    const sample = requiredSample(samples, id);

    expect(
      pixelDistance(sample.pixel, clear),
      `expected light-frame sample '${id}' to differ from the clear color`,
    ).toBeGreaterThan(45);
    expect(luminance(sample.pixel)).toBeLessThan(luminance(clear) - 45);
  }
}

function luminance(pixel: {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}): number {
  return 0.2126 * pixel.r + 0.7152 * pixel.g + 0.0722 * pixel.b;
}

function requiredSample(
  samples: NonNullable<NonNullable<MsdfTextFrameStatus["readback"]>["samples"]>,
  id: string,
): NonNullable<
  NonNullable<MsdfTextFrameStatus["readback"]>["samples"]
>[number] {
  const sample = samples.find((entry) => entry.id === id);

  expect(sample, `missing readback sample '${id}'`).toBeDefined();

  return sample as NonNullable<
    NonNullable<MsdfTextFrameStatus["readback"]>["samples"]
  >[number];
}
