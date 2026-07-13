import { expect, test, type Page } from "@playwright/test";

import {
  attachExampleStatus,
  attachWebGpuValidationConsoleGuard,
  expectStatusJsonSafeForGpu,
  skipIfUnsupportedWebGpu,
  waitForExampleStatus,
  waitForPresentedFrames,
} from "./webgpu-status.js";
import type { ExampleStatusBase } from "./example-status-types.js";

interface LuminanceHistogramStatus extends ExampleStatusBase {
  readonly passesRegistered: boolean;
  readonly pixelCount: number;
  readonly binCount: number;
  readonly rawRan: boolean;
  readonly kernelRan: boolean;
  readonly rawExecutedCommands: number;
  readonly kernelExecutedCommands: number;
  readonly readbackIdentical: boolean | null;
  readonly frameOk: boolean | null;
}

interface HistogramReadback {
  readonly raw: readonly number[] | null;
  readonly kernel: readonly number[] | null;
  readonly identical: boolean;
}

// Constants inlined from examples/luminance-histogram-scene.js (a test importing
// the untyped example JS fails tsc-test). Each of the 64 pixels lands in exactly
// one of the 16 bins, so both histograms sum to the pixel count.
const HISTOGRAM_PIXEL_COUNT = 64;
const HISTOGRAM_BIN_COUNT = 16;

async function readbackHistograms(
  page: Page,
): Promise<HistogramReadback | null> {
  return page.evaluate(
    () =>
      (
        globalThis as {
          readonly __APERTURE_HISTOGRAM__?: {
            readback: () => Promise<HistogramReadback>;
          };
        }
      ).__APERTURE_HISTOGRAM__?.readback() ?? null,
  );
}

// C3 (three.js parity plan): the luminance histogram is computed TWO ways from
// the same input — a RAW app.addComputePass dispatch (hand-built pipeline + bind
// group) and a DATA-DESCRIBED app.addComputeKernelPass dispatch (a
// ComputeKernelAsset: WGSL + typed bindings, no GPUDevice code). This asserts the
// two GPU readbacks are byte-identical: the data-described dispatch produces the
// exact same result as the hand-built one.
test("luminance histogram: the data-described kernel dispatch matches the raw dispatch byte-for-byte", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/luminance-histogram.html");
  const initialStatus =
    await waitForExampleStatus<LuminanceHistogramStatus>(page);

  expect(
    initialStatus,
    "luminance-histogram status should publish",
  ).toBeDefined();
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
                readonly __APERTURE_EXAMPLE_STATUS__?: LuminanceHistogramStatus;
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
          readonly __APERTURE_EXAMPLE_STATUS__: LuminanceHistogramStatus;
        }
      ).__APERTURE_EXAMPLE_STATUS__,
  );
  await attachExampleStatus("luminance-histogram-status", status);
  expectStatusJsonSafeForGpu(status);

  // Both dispatches ran the same frame (raw encode + data-described kernel).
  expect(status).toMatchObject({
    example: "luminance-histogram",
    ok: true,
    frameOk: true,
    passesRegistered: true,
    rawRan: true,
    kernelRan: true,
    pixelCount: HISTOGRAM_PIXEL_COUNT,
    binCount: HISTOGRAM_BIN_COUNT,
  });

  // Let the compute writes settle, then read both output buffers back.
  await waitForPresentedFrames(page, 4);
  const readback = await readbackHistograms(page);

  expect(readback, "readback hook should resolve").not.toBeNull();
  if (readback === null) {
    return;
  }
  await attachExampleStatus("luminance-histogram-readback", readback);

  expect(readback.raw).not.toBeNull();
  expect(readback.kernel).not.toBeNull();
  const raw = readback.raw ?? [];
  const kernel = readback.kernel ?? [];

  // Both histograms are the right shape and account for every pixel (a
  // non-degenerate, actually-computed result — not all zeros).
  expect(raw).toHaveLength(HISTOGRAM_BIN_COUNT);
  expect(kernel).toHaveLength(HISTOGRAM_BIN_COUNT);
  expect(raw.reduce((sum, value) => sum + value, 0)).toBe(
    HISTOGRAM_PIXEL_COUNT,
  );
  expect(kernel.reduce((sum, value) => sum + value, 0)).toBe(
    HISTOGRAM_PIXEL_COUNT,
  );

  // The core assertion: the data-described kernel readback equals the raw
  // readback bin-for-bin.
  expect(kernel).toEqual(raw);
  expect(readback.identical).toBe(true);

  webGpuValidation.expectNoWarnings();
});
