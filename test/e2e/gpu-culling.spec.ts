import { expect, test, type Page } from "@playwright/test";

import { pixelDistance, readPngImage, readPngImagePixel } from "./png.js";
import {
  attachExampleStatus,
  attachWebGpuValidationConsoleGuard,
  expectStatusJsonSafeForGpu,
  skipIfUnsupportedWebGpu,
  waitForExampleStatus,
  waitForPresentedFrames,
} from "./webgpu-status.js";
import type { ExampleStatusBase } from "./example-status-types.js";

interface GpuCullingStatus extends ExampleStatusBase {
  readonly passesRegistered: boolean;
  readonly instanceCount: number;
  readonly cullThreshold: number;
  readonly computeRan: boolean;
  readonly drawRan: boolean;
  readonly indirectStatus: string | null;
  readonly indirectDrawCount: number;
  readonly drawnInstanceCount: number | null;
  readonly fallbackReasons: readonly string[];
  readonly frameOk: boolean | null;
}

// Constants inlined from examples/gpu-culling-scene.js (a test importing the
// untyped example JS fails tsc-test). instanceClipX(i) = -0.75 + 0.3 * i for
// i in [0, 6): x = -0.75, -0.45, -0.15, 0.15, 0.45, 0.75.
const CULL_INSTANCE_COUNT = 6;
// Threshold that culls the three right-hand instances (x = 0.15, 0.45, 0.75),
// leaving x <= -0.1 → three survivors.
const CULLED_THRESHOLD = -0.1;
const CULLED_VISIBLE_COUNT = 3;

async function setCullThreshold(page: Page, threshold: number): Promise<void> {
  await page.evaluate((value) => {
    (
      globalThis as {
        readonly __APERTURE_GPU_CULLING__?: {
          setCullThreshold: (value: number) => void;
        };
      }
    ).__APERTURE_GPU_CULLING__?.setCullThreshold(value);
  }, threshold);
}

async function readDrawnInstanceCount(page: Page): Promise<number | null> {
  return page.evaluate(
    () =>
      (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: GpuCullingStatus;
        }
      ).__APERTURE_EXAMPLE_STATUS__?.drawnInstanceCount ?? null,
  );
}

// C2 (three.js parity plan): GPU-driven culling + indirect draw. A compute pass
// culls a small instance set and writes the survivor count into an indirect
// argument buffer; a user render pass draws it with a single ctx.drawIndirect().
// The drawn instance count is GPU-authoritative and surfaces in the frame report
// (report.userIndirectDraws.drawnInstanceCount); lowering the cull threshold must
// REDUCE it.
test("gpu culling: a compute-written indirect draw's drawn count reduces when instances are culled", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/gpu-culling.html");
  const initialStatus = await waitForExampleStatus<GpuCullingStatus>(page);

  expect(initialStatus, "gpu-culling status should publish").toBeDefined();
  if (initialStatus === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(initialStatus);

  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            (
              globalThis as {
                readonly __APERTURE_EXAMPLE_STATUS__?: GpuCullingStatus;
              }
            ).__APERTURE_EXAMPLE_STATUS__?.ok === true,
        ),
      { timeout: 45000 },
    )
    .toBe(true);

  const status = await page.evaluate(
    () =>
      (
        globalThis as unknown as {
          readonly __APERTURE_EXAMPLE_STATUS__: GpuCullingStatus;
        }
      ).__APERTURE_EXAMPLE_STATUS__,
  );
  await attachExampleStatus("gpu-culling-status", status);
  expectStatusJsonSafeForGpu(status);

  expect(status).toMatchObject({
    example: "gpu-culling",
    ok: true,
    frameOk: true,
    passesRegistered: true,
    computeRan: true,
    drawRan: true,
    instanceCount: CULL_INSTANCE_COUNT,
    indirectStatus: "readback",
    indirectDrawCount: 1,
  });
  expect(status.fallbackReasons).toEqual([]);

  // Every instance visible: the GPU-computed drawn count equals the full set.
  await setCullThreshold(page, 1.5);
  await expect
    .poll(
      async () => {
        await waitForPresentedFrames(page, 4);
        return readDrawnInstanceCount(page);
      },
      { timeout: 30000 },
    )
    .toBe(CULL_INSTANCE_COUNT);

  // Snapshot the fully-visible field, then cull the right-hand instances.
  const fullCapture = await page.locator("#aperture-canvas").screenshot();
  await test.info().attach("gpu-culling-full.png", {
    body: fullCapture,
    contentType: "image/png",
  });

  // Cull half: the drawn count MUST reduce (this is the GPU-driven-culling
  // assertion — the reduction is computed on the GPU and only known via readback).
  await setCullThreshold(page, CULLED_THRESHOLD);
  await expect
    .poll(
      async () => {
        await waitForPresentedFrames(page, 4);
        return readDrawnInstanceCount(page);
      },
      { timeout: 30000 },
    )
    .toBe(CULLED_VISIBLE_COUNT);

  const culledDrawn = await readDrawnInstanceCount(page);
  expect(
    culledDrawn ?? Infinity,
    "culled drawn count must be below the full count",
  ).toBeLessThan(CULL_INSTANCE_COUNT);

  const culledCapture = await page.locator("#aperture-canvas").screenshot();
  await test.info().attach("gpu-culling-culled.png", {
    body: culledCapture,
    contentType: "image/png",
  });

  // The right side of the canvas (where culled instances were) must lose pixels:
  // the fully-visible capture differs from the culled one somewhere on the right.
  const fullImage = readPngImage(fullCapture);
  const culledImage = readPngImage(culledCapture);
  let strongestRightDelta = 0;
  for (let x = 0.6; x <= 0.9; x += 0.05) {
    for (let y = 0.35; y <= 0.65; y += 0.05) {
      strongestRightDelta = Math.max(
        strongestRightDelta,
        pixelDistance(
          readPngImagePixel(fullImage, x, y),
          readPngImagePixel(culledImage, x, y),
        ),
      );
    }
  }
  expect(
    strongestRightDelta,
    "culling should visibly remove right-hand triangles",
  ).toBeGreaterThan(12);

  webGpuValidation.expectNoWarnings();
});
