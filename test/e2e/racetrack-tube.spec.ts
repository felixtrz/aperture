import { expect, test, type Page } from "@playwright/test";

import {
  pixelDistance,
  readPngImage,
  readPngImagePixel,
  rgbaColorToPixel,
} from "./png.js";
import {
  attachExampleStatus,
  attachWebGpuValidationConsoleGuard,
  expectStatusJsonSafeForGpu,
  skipIfUnsupportedWebGpu,
  waitForExampleStatus,
  waitForPresentedFrames,
} from "./webgpu-status.js";
import type { ExampleStatusBase } from "./example-status-types.js";

// Parity plan G2: a procedural racetrack tube swept along a closed Catmull-Rom
// loop with `createTubeMeshAsset` (parallel-transport frame) and drawn through
// the app facade with one built-in `material.standard()`. The e2e proves the
// single tube mesh draws in one frame and that the presented canvas is
// non-trivially covered by the lit loop (screenshot coverage readback).

interface RacetrackTubeStatus extends ExampleStatusBase {
  readonly state?: string;
  readonly clearColor?: readonly [number, number, number, number];
  readonly tube?: {
    readonly expectedMeshDraws: number;
  };
  readonly frame?: {
    readonly counts?: {
      readonly views: number;
      readonly meshDraws: number;
      readonly drawCalls: number;
      readonly diagnostics: number;
    } | null;
  };
}

const racetrackTubeExpectedMeshDraws = 1;
const racetrackTubeClearColor = { r: 0.02, g: 0.03, b: 0.05, a: 1 };

test("app facade renders the procedural racetrack tube through the standard material", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/racetrack-tube.html");

  const initialStatus = await waitForExampleStatus<RacetrackTubeStatus>(page);

  expect(initialStatus, "racetrack-tube status should publish").toBeDefined();

  if (initialStatus === undefined) {
    return;
  }

  // The generated app publishes {state:"starting"} before WebGPU settles; wait
  // for a terminal state before deciding between skip and assert.
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: RacetrackTubeStatus;
        }
      ).__APERTURE_EXAMPLE_STATUS__;

      return status !== undefined && status.state !== "starting";
    },
    undefined,
    { timeout: 60000 },
  );

  const settledStatus = await readRacetrackTubeStatus(page);

  skipIfUnsupportedWebGpu(settledStatus);

  const status = await waitForRacetrackTubeOk(page);

  await attachExampleStatus("racetrack-tube-status", status);
  expectStatusJsonSafeForGpu(status);

  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "racetrack-tube",
    ok: true,
    state: "running",
    renderingBackend: "webgpu-explicit",
    tube: {
      expectedMeshDraws: racetrackTubeExpectedMeshDraws,
    },
    frame: {
      counts: {
        views: 1,
        meshDraws: racetrackTubeExpectedMeshDraws,
        diagnostics: 0,
      },
    },
  });
  expect(status.frame?.counts?.drawCalls ?? 0).toBeGreaterThanOrEqual(1);

  await waitForPresentedFrames(page);

  const screenshot = await page.locator("#aperture-canvas").screenshot();

  await test.info().attach("racetrack-tube.png", {
    body: screenshot,
    contentType: "image/png",
  });

  assertRacetrackTubeCoverage(screenshot);
  webGpuValidation.expectNoWarnings();
});

function assertRacetrackTubeCoverage(screenshot: Buffer): void {
  const image = readPngImage(screenshot);
  const clear = rgbaColorToPixel(racetrackTubeClearColor);
  const step = 0.05;
  let covered = 0;
  let total = 0;

  for (let y = 0.1; y <= 0.9 + 1e-9; y += step) {
    for (let x = 0.1; x <= 0.9 + 1e-9; x += step) {
      const pixel = readPngImagePixel(image, x, y);
      total += 1;

      if (pixelDistance(pixel, clear) > 30) {
        covered += 1;
      }
    }
  }

  // The oval tube ring must paint a non-trivial share of the sampled region
  // (proving the sweep drew), while the loop's interior stays clear.
  expect(covered / total).toBeGreaterThan(0.05);
}

async function readRacetrackTubeStatus(
  page: Page,
): Promise<RacetrackTubeStatus> {
  return page.evaluate(
    () =>
      (
        globalThis as unknown as {
          readonly __APERTURE_EXAMPLE_STATUS__: RacetrackTubeStatus;
        }
      ).__APERTURE_EXAMPLE_STATUS__,
  );
}

async function waitForRacetrackTubeOk(
  page: Page,
): Promise<RacetrackTubeStatus> {
  await page.waitForFunction(
    (expectedMeshDraws) => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: RacetrackTubeStatus;
        }
      ).__APERTURE_EXAMPLE_STATUS__;

      return (
        status?.ok === true &&
        status.frame?.counts?.meshDraws === expectedMeshDraws
      );
    },
    racetrackTubeExpectedMeshDraws,
    { timeout: 120000 },
  );

  return readRacetrackTubeStatus(page);
}
