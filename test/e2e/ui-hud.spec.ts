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

interface UiHudStatus extends ExampleStatusBase {
  readonly hud?: {
    readonly textureKey: string;
    readonly samplerKey: string;
    readonly fontKey: string;
    readonly expected: {
      readonly uiNodes: number;
      readonly uiHitRegions: number;
      readonly drawCalls: number;
      readonly textGlyphs: number;
    };
  };
  readonly frame?: {
    readonly snapshot?: {
      readonly views: number;
      readonly meshDraws: number;
      readonly uiNodes: number;
      readonly uiHitRegions: number;
      readonly diagnostics: number;
    };
    readonly counts?: {
      readonly uiNodes: number;
      readonly uiHitRegions: number;
      readonly drawCalls: number;
      readonly diagnostics: number;
    };
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
  };
}

test("browser renders worker-authored retained UI HUD overlay", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/ui-hud.html");

  const status = await waitForExampleStatus<UiHudStatus>(page);

  await attachExampleStatus("ui-hud-status", status);
  expect(status, "UI HUD status should publish").toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "ui-hud",
    ok: true,
    phase: "submit",
    renderingBackend: "webgpu-explicit",
    hud: {
      textureKey: "texture:ui-hud-icon",
      samplerKey: "sampler:ui-hud-linear",
      fontKey: "font-atlas:ui-hud-font",
      expected: {
        uiNodes: 6,
        uiHitRegions: 1,
        drawCalls: 5,
        textGlyphs: 2,
      },
    },
    frame: {
      snapshot: {
        views: 1,
        meshDraws: 0,
        uiNodes: 6,
        uiHitRegions: 1,
        diagnostics: 0,
      },
      counts: {
        uiNodes: 6,
        uiHitRegions: 1,
        drawCalls: 5,
        diagnostics: 0,
      },
    },
  });

  const readback = status.frame?.readback;

  if (readback?.ok !== true) {
    test.skip(
      true,
      `UI HUD pixel assertion requires readback: ${readback?.reason ?? "unknown"}`,
    );
  }

  webGpuValidation.expectNoWarnings();
  assertUiHudPixels(status);
});

function assertUiHudPixels(status: UiHudStatus): void {
  const clear = rgbaColorToPixel({ r: 0.018, g: 0.022, b: 0.03, a: 1 });
  const samples = status.frame?.readback?.samples ?? [];
  const background = requiredSample(samples, "background");
  const clipped = requiredSample(samples, "clipped-outside");
  const panel = requiredSample(samples, "panel-fill");
  const top = requiredSample(samples, "stack-top");
  const image = requiredSample(samples, "image-fill");
  const text = requiredSample(samples, "text-fill");

  expect(pixelDistance(background.pixel, clear)).toBeLessThan(35);
  expect(pixelDistance(clipped.pixel, clear)).toBeLessThan(35);
  expect(pixelDistance(panel.pixel, clear)).toBeGreaterThan(25);
  expect(top.pixel.r).toBeGreaterThan(180);
  expect(top.pixel.g).toBeLessThan(80);
  expect(top.pixel.b).toBeLessThan(100);
  expect(image.pixel.g).toBeGreaterThan(130);
  expect(image.pixel.b).toBeGreaterThan(150);
  expect(text.pixel.r).toBeGreaterThan(150);
  expect(text.pixel.g).toBeGreaterThan(150);
  expect(text.pixel.b).toBeGreaterThan(150);
}

function requiredSample(
  samples: NonNullable<
    NonNullable<UiHudStatus["frame"]>["readback"]
  >["samples"],
  id: string,
): NonNullable<
  NonNullable<NonNullable<UiHudStatus["frame"]>["readback"]>["samples"]
>[number] {
  const sample = samples?.find((entry) => entry.id === id);

  expect(sample, `missing readback sample '${id}'`).toBeDefined();

  return sample as NonNullable<
    NonNullable<NonNullable<UiHudStatus["frame"]>["readback"]>["samples"]
  >[number];
}
