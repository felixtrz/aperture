import { expect, test } from "@playwright/test";

import { pixelDistance, readPngPixel, rgbaColorToPixel } from "./png.js";
import {
  attachExampleStatus,
  attachWebGpuValidationConsoleGuard,
  expectStatusJsonSafeForGpu,
  loadExampleStatus,
} from "./webgpu-status.js";
import type { ExampleStatusBase } from "./example-status-types.js";

interface BatchingStatus extends ExampleStatusBase {
  readonly sourceShapeCount?: number;
  readonly shapesPerBatch?: number;
  readonly mergedMeshCount?: number;
  readonly queuePlan?: {
    readonly sourceRecords: number;
    readonly plannedRecords: number;
    readonly sourceRecordCounts: readonly number[];
    readonly drawKinds: readonly string[];
  };
  readonly samples?: readonly {
    readonly id: string;
    readonly x: number;
    readonly y: number;
  }[];
  readonly clearColor?: {
    readonly r: number;
    readonly g: number;
    readonly b: number;
    readonly a: number;
  };
  readonly counts?: {
    readonly meshDraws: number;
    readonly drawPackages: number;
    readonly drawCalls: number;
    readonly diagnostics: number;
  };
}

test("batching example renders heterogeneous shapes in five draws", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);
  const status = await loadExampleStatus<BatchingStatus>(
    page,
    "/examples/batching.html",
    "batching-status",
  );

  if (status === undefined) {
    return;
  }

  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "batching",
    ok: true,
    phase: "submit",
    renderingBackend: "webgpu-explicit",
    sourceShapeCount: 20,
    shapesPerBatch: 4,
    mergedMeshCount: 5,
    queuePlan: {
      sourceRecords: 20,
      plannedRecords: 5,
      sourceRecordCounts: [4, 4, 4, 4, 4],
      drawKinds: [
        "static-merged",
        "static-merged",
        "static-merged",
        "static-merged",
        "static-merged",
      ],
    },
    counts: {
      meshDraws: 5,
      drawPackages: 5,
      drawCalls: 5,
      diagnostics: 0,
    },
  });
  expect(status.counts?.drawCalls ?? 99).toBeLessThan(
    status.sourceShapeCount ?? 0,
  );
  webGpuValidation.expectNoWarnings();

  await attachExampleStatus("batching-status", status);

  const clear = rgbaColorToPixel(
    status.clearColor ?? { r: 0.014, g: 0.018, b: 0.025, a: 1 },
  );
  const screenshot = await page.locator("#aperture-canvas").screenshot();

  for (const sample of status.samples ?? []) {
    expect(
      maxNeighborhoodDistanceFromClear(screenshot, sample.x, sample.y, clear),
      `${sample.id} should contain a static-batched shape pixel`,
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
