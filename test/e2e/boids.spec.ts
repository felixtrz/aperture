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

interface BoidsStatus extends ExampleStatusBase {
  readonly boidCount: number;
  readonly meshDraws: number;
  readonly drawCalls: number;
  readonly computeRegistered: boolean;
  readonly computeRan: boolean;
  readonly computeExecutedCommands: number;
  readonly computeBeforeDraw: boolean;
  readonly order: readonly string[];
  readonly frameOk: boolean | null;
}

type PositionSamples = readonly (readonly [number, number])[];

// C1 (three.js parity plan): GPU boids. A compute pass integrates flock
// positions in a WRITABLE storage buffer; an instanced custom material renders
// them the same frame with zero CPU copies, consuming that buffer BOTH as a
// storage binding and as a buffer-backed instance stream. The frame graph
// orders compute-before-draw.
test("gpu boids: compute writes a storage buffer an instanced custom material consumes the same frame", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/boids.html");
  const initialStatus = await waitForExampleStatus<BoidsStatus>(page);

  expect(initialStatus, "boids status should publish").toBeDefined();

  if (initialStatus === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(initialStatus);

  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const status = (
            globalThis as {
              readonly __APERTURE_EXAMPLE_STATUS__?: BoidsStatus;
            }
          ).__APERTURE_EXAMPLE_STATUS__;

          return status?.ok === true;
        }),
      { timeout: 45000 },
    )
    .toBe(true);

  const status = await page.evaluate(
    () =>
      (
        globalThis as unknown as {
          readonly __APERTURE_EXAMPLE_STATUS__: BoidsStatus;
        }
      ).__APERTURE_EXAMPLE_STATUS__,
  );

  await attachExampleStatus("boids-status", status);
  expectStatusJsonSafeForGpu(status);

  // Entity / instance counts: BOID_COUNT mesh draws collapse into a small number
  // of instanced draw calls (one shared mesh + material).
  expect(status).toMatchObject({
    example: "boids",
    ok: true,
    frameOk: true,
    boidCount: 160,
    meshDraws: 160,
    computeRegistered: true,
    computeRan: true,
    computeBeforeDraw: true,
  });
  expect(status.computeExecutedCommands).toBeGreaterThan(0);
  expect(status.drawCalls).toBeGreaterThan(0);
  expect(status.drawCalls).toBeLessThan(status.boidCount);

  // Determinism of the authored schedule: the compute-before-draw ordering holds
  // and the instanced draw count is stable across frames (the GPU float
  // positions are intentionally NOT asserted — those differ per adapter; the
  // determinism gate covers the CPU/ECS schedule via test/determinism).
  const computeIndex = status.order.indexOf("boids-sim");
  const sceneIndex = status.order.findIndex((name) => name.includes(":fg:"));
  expect(computeIndex).toBeGreaterThanOrEqual(0);
  expect(sceneIndex).toBeGreaterThanOrEqual(0);
  expect(computeIndex).toBeLessThan(sceneIndex);

  // Motion readback: sample flock positions directly off the GPU buffer across
  // two frames. The positions MUST change (the compute pass moved them on the
  // GPU — there are zero CPU writes to these positions).
  await waitForPresentedFrames(page, 4);
  const firstSamples = await readbackPositions(page);
  expect(firstSamples, "first readback should return samples").not.toBeNull();

  let motion = 0;
  let lastSamples: PositionSamples | null = firstSamples;
  await expect
    .poll(
      async () => {
        await waitForPresentedFrames(page, 12);
        const nextSamples = await readbackPositions(page);
        lastSamples = nextSamples;
        motion = maxPositionDelta(firstSamples, nextSamples);
        return motion;
      },
      { timeout: 30000 },
    )
    .toBeGreaterThan(0.01);

  expect(lastSamples, "later readback should return samples").not.toBeNull();

  // Pixel motion: the rendered flock must move on screen between two captures,
  // and the field must contain non-clear pixels (a black canvas cannot pass).
  const firstCapture = await page.locator("#aperture-canvas").screenshot();
  await test.info().attach("boids-first.png", {
    body: firstCapture,
    contentType: "image/png",
  });
  const firstImage = readPngImage(firstCapture);
  let lastCapture: Buffer = firstCapture;

  await expect
    .poll(
      async () => {
        await waitForPresentedFrames(page, 12);
        lastCapture = await page.locator("#aperture-canvas").screenshot();
        const nextImage = readPngImage(lastCapture);
        let strongest = 0;

        for (let y = 0.15; y <= 0.85; y += 0.05) {
          for (let x = 0.15; x <= 0.85; x += 0.05) {
            strongest = Math.max(
              strongest,
              pixelDistance(
                readPngImagePixel(firstImage, x, y),
                readPngImagePixel(nextImage, x, y),
              ),
            );
          }
        }

        return strongest;
      },
      { timeout: 30000 },
    )
    .toBeGreaterThan(12);

  await test.info().attach("boids-second.png", {
    body: lastCapture,
    contentType: "image/png",
  });

  const clear = { r: 5, g: 8, b: 13, a: 255 };
  let strongestClearDistance = 0;
  const lastImage = readPngImage(lastCapture);
  for (let y = 0.15; y <= 0.85; y += 0.05) {
    for (let x = 0.15; x <= 0.85; x += 0.05) {
      strongestClearDistance = Math.max(
        strongestClearDistance,
        pixelDistance(readPngImagePixel(lastImage, x, y), clear),
      );
    }
  }
  expect(
    strongestClearDistance,
    "boids canvas should contain non-clear pixels",
  ).toBeGreaterThan(24);

  webGpuValidation.expectNoWarnings();
});

async function readbackPositions(page: Page): Promise<PositionSamples | null> {
  return page.evaluate(async () => {
    const boids = (
      globalThis as unknown as {
        readonly __APERTURE_BOIDS__?: {
          readbackPositions: (
            sampleCount?: number,
          ) => Promise<readonly (readonly [number, number])[] | null>;
        };
      }
    ).__APERTURE_BOIDS__;

    if (boids === undefined) {
      return null;
    }

    return boids.readbackPositions(12);
  });
}

function maxPositionDelta(
  a: PositionSamples | null,
  b: PositionSamples | null,
): number {
  if (a === null || b === null) {
    return 0;
  }

  let strongest = 0;
  const count = Math.min(a.length, b.length);
  for (let index = 0; index < count; index += 1) {
    const before = a[index];
    const after = b[index];
    if (before === undefined || after === undefined) {
      continue;
    }
    const dx = before[0] - after[0];
    const dy = before[1] - after[1];
    strongest = Math.max(strongest, Math.hypot(dx, dy));
  }
  return strongest;
}
