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

interface RectAreaLightStatus extends ExampleStatusBase {
  readonly areaLight?: {
    readonly kind: "rect-area";
    readonly width: number;
    readonly height: number;
    readonly intensity: number;
  };
  readonly counts?: {
    readonly meshDraws: number;
    readonly lights: number;
    readonly diagnostics: number;
    readonly drawCalls: number;
  };
  readonly resources?: {
    readonly lightBindGroup: number;
    readonly lightGpuBuffers: number;
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

test("browser renders a StandardMaterial surface lit by an ECS RectAreaLight", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/rect-area-light.html");

  const status = await waitForExampleStatus<RectAreaLightStatus>(page);

  await attachExampleStatus("rect-area-light-status", status);
  expect(status, "rect area light status should publish").toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "rect-area-light",
    ok: true,
    phase: "submit",
    renderingBackend: "webgpu-explicit",
    areaLight: {
      kind: "rect-area",
      width: 1.65,
      height: 0.58,
    },
    counts: {
      meshDraws: 1,
      lights: 2,
      diagnostics: 0,
      drawCalls: 1,
    },
    resources: {
      lightBindGroup: 1,
      lightGpuBuffers: 2,
    },
  });

  if (status.readback?.ok !== true) {
    test.skip(
      true,
      `RectAreaLight pixel assertion requires readback: ${status.readback?.reason ?? "unknown"}`,
    );
  }

  const center = status.readback?.samples?.find(
    (sample) => sample.id === "center-lit",
  );
  const left = status.readback?.samples?.find(
    (sample) => sample.id === "left-falloff",
  );
  const right = status.readback?.samples?.find(
    (sample) => sample.id === "right-falloff",
  );
  const clear = rgbaColorToPixel({ r: 0.012, g: 0.018, b: 0.026, a: 1 });

  expect(center, JSON.stringify(status, null, 2)).toBeDefined();
  expect(left, JSON.stringify(status, null, 2)).toBeDefined();
  expect(right, JSON.stringify(status, null, 2)).toBeDefined();

  if (center === undefined || left === undefined || right === undefined) {
    return;
  }

  expect(pixelDistance(center.pixel, clear)).toBeGreaterThan(35);
  expect(pixelLuma(center.pixel)).toBeGreaterThan(pixelLuma(left.pixel) + 4);
  expect(pixelLuma(center.pixel)).toBeGreaterThan(pixelLuma(right.pixel) + 4);
  webGpuValidation.expectNoWarnings();
});

function pixelLuma(pixel: {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}): number {
  return pixel.r * 0.2126 + pixel.g * 0.7152 + pixel.b * 0.0722;
}
