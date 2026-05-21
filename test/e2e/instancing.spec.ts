import { expect, test } from "@playwright/test";

import { pixelDistance, readPngPixel, rgbaColorToPixel } from "./png.js";
import {
  attachExampleStatus,
  attachWebGpuValidationConsoleGuard,
  expectStatusJsonSafeForGpu,
  loadExampleStatus,
} from "./webgpu-status.js";
import type { ExampleStatusBase } from "./example-status-types.js";

interface InstancingStatus extends ExampleStatusBase {
  readonly instanceCount?: number;
  readonly grid?: {
    readonly columns: number;
    readonly rows: number;
  };
  readonly clearColor?: {
    readonly r: number;
    readonly g: number;
    readonly b: number;
    readonly a: number;
  };
}

test("instancing example renders 1,000 ECS boxes as one grouped draw", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);
  const status = await loadExampleStatus<InstancingStatus>(
    page,
    "/examples/instancing.html",
    "instancing-status",
  );

  if (status === undefined) {
    return;
  }

  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "instancing",
    ok: true,
    phase: "submit",
    renderingBackend: "webgpu-explicit",
    instanceCount: 1000,
    grid: { columns: 40, rows: 25 },
    counts: {
      meshDraws: 1000,
      drawPackages: 1000,
      drawCalls: 1,
      diagnostics: 0,
    },
  });
  webGpuValidation.expectNoWarnings();

  await attachExampleStatus("instancing-status", status);

  const clear = rgbaColorToPixel(
    status.clearColor ?? { r: 0.012, g: 0.016, b: 0.024, a: 1 },
  );
  const screenshot = await page.locator("#aperture-canvas").screenshot();

  for (const sample of [
    { id: "left", x: 0.42, y: 0.5 },
    { id: "center", x: 0.5, y: 0.5 },
    { id: "right", x: 0.58, y: 0.5 },
  ]) {
    expect(
      maxNeighborhoodDistanceFromClear(screenshot, sample.x, sample.y, clear),
      `${sample.id} region should contain an instanced cube pixel`,
    ).toBeGreaterThan(35);
  }
});

function maxNeighborhoodDistanceFromClear(
  screenshot: Buffer,
  x: number,
  y: number,
  clear: ReturnType<typeof rgbaColorToPixel>,
): number {
  let maxDistance = 0;

  for (const dx of [-0.012, -0.006, 0, 0.006, 0.012]) {
    for (const dy of [-0.012, -0.006, 0, 0.006, 0.012]) {
      const pixel = readPngPixel(
        screenshot,
        Math.min(0.98, Math.max(0.02, x + dx)),
        Math.min(0.98, Math.max(0.02, y + dy)),
      );

      maxDistance = Math.max(maxDistance, pixelDistance(pixel, clear));
    }
  }

  return maxDistance;
}
