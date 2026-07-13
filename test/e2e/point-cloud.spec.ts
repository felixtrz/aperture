import { expect, test, type Page } from "@playwright/test";

import { readPngImage, type PngImage, type RgbaPixel } from "./png.js";
import {
  attachExampleStatus,
  attachWebGpuValidationConsoleGuard,
  expectStatusJsonSafeForGpu,
  skipIfUnsupportedWebGpu,
  waitForExampleStatus,
  waitForPresentedFrames,
} from "./webgpu-status.js";
import type { ExampleStatusBase } from "./example-status-types.js";

interface PointReport {
  readonly clouds?: number;
  readonly points?: number;
  readonly drawnPoints?: number;
}

interface PointCloudStatus extends ExampleStatusBase {
  readonly pointReport?: PointReport | null;
  readonly pointDiagnostics?: readonly string[];
  readonly samplePoints?: {
    readonly probeRowY: number;
    readonly nearProbeX: number;
    readonly farProbeX: number;
    readonly backgroundX: number;
    readonly backgroundY: number;
  };
}

interface WhiteRun {
  readonly start: number;
  readonly end: number;
  readonly length: number;
  readonly centerX: number;
}

function pixelAt(image: PngImage, x: number, y: number): RgbaPixel {
  const cx = Math.max(0, Math.min(image.width - 1, x));
  const cy = Math.max(0, Math.min(image.height - 1, y));
  const offset = (cy * image.width + cx) * image.bytesPerPixel;
  return {
    r: image.pixels[offset] ?? 0,
    g: image.pixels[offset + 1] ?? 0,
    b: image.pixels[offset + 2] ?? 0,
    a: image.bytesPerPixel === 4 ? (image.pixels[offset + 3] ?? 0) : 255,
  };
}

function isWhite(p: RgbaPixel): boolean {
  return p.r > 170 && p.g > 170 && p.b > 170;
}

function isBackground(p: RgbaPixel): boolean {
  return p.r < 100 && p.g < 100 && p.b < 120;
}

function whiteRuns(image: PngImage, rowY: number): readonly WhiteRun[] {
  const runs: WhiteRun[] = [];
  let start = -1;
  for (let x = 0; x <= image.width; x += 1) {
    const white = x < image.width && isWhite(pixelAt(image, x, rowY));
    if (white && start === -1) {
      start = x;
    } else if (!white && start !== -1) {
      runs.push({
        start,
        end: x - 1,
        length: x - start,
        centerX: (start + x - 1) / 2,
      });
      start = -1;
    }
  }
  return runs.filter((run) => run.length >= 2);
}

function closestRun(
  runs: readonly WhiteRun[],
  targetX: number,
): WhiteRun | undefined {
  let best: WhiteRun | undefined;
  let bestDistance = Infinity;
  for (const run of runs) {
    const distance = Math.abs(run.centerX - targetX);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = run;
    }
  }
  return best;
}

// E1: the point subsystem draws each point as a camera-facing quad sized in
// world units with perspective size attenuation. This asserts the NEAR white
// probe covers more pixels than the FAR white probe (attenuation) and that a
// point renders as a multi-pixel disc (not a single pixel).
test("browser draws perspective-attenuated point-cloud points", async ({
  page,
}: {
  page: Page;
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.setViewportSize({ width: 1024, height: 720 });
  await page.goto("/examples/point-cloud.html");

  const status = await waitForExampleStatus<PointCloudStatus>(page);
  await attachExampleStatus("point-cloud-status", status);
  expect(status, "status should publish").toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "point-cloud",
    ok: true,
    phase: "submit",
    renderingBackend: "webgpu-explicit",
  });

  const report = status.pointReport ?? {};
  expect(report.clouds).toBe(2);
  expect(report.points).toBe(7);
  expect(report.drawnPoints).toBe(7);
  expect(status.pointDiagnostics ?? []).toEqual([]);

  await waitForPresentedFrames(page);
  const screenshot = await page.locator("#point-cloud-canvas").screenshot();
  await test.info().attach("point-cloud-canvas", {
    body: screenshot,
    contentType: "image/png",
  });
  const image = readPngImage(screenshot);
  const samples = status.samplePoints;
  expect(samples, "sample points published").toBeDefined();

  if (samples === undefined) {
    return;
  }

  // Scan the probe row: the near probe (left) and far probe (right) are white
  // discs. Perspective attenuation makes the near disc wider than the far one.
  const rowY = Math.round(samples.probeRowY * image.height);
  const runs = whiteRuns(image, rowY);
  const near = closestRun(runs, samples.nearProbeX * image.width);
  const far = closestRun(runs, samples.farProbeX * image.width);
  await test.info().attach("point-cloud-runs", {
    body: JSON.stringify({ runs, near, far }, null, 2),
    contentType: "application/json",
  });

  expect(runs.length, "both probe discs render").toBeGreaterThanOrEqual(2);
  expect(near, "near probe found").toBeDefined();
  expect(far, "far probe found").toBeDefined();

  if (near === undefined || far === undefined) {
    return;
  }

  expect(near.start, "near probe is left of the far probe").toBeLessThan(
    far.start,
  );
  // A point renders as a multi-pixel disc (not a single pixel).
  expect(
    near.length,
    "near disc covers multiple pixels",
  ).toBeGreaterThanOrEqual(4);
  // Perspective size attenuation: the near disc is wider than the far disc.
  expect(
    near.length,
    "near disc is larger than the far disc (attenuation)",
  ).toBeGreaterThan(far.length);

  const background = pixelAt(
    image,
    Math.round(samples.backgroundX * image.width),
    Math.round(samples.backgroundY * image.height),
  );
  expect(isBackground(background), "control pixel is background").toBe(true);

  await page.evaluate(() => {
    const stop = (
      globalThis as typeof globalThis & {
        readonly __APERTURE_POINT_CLOUD_STOP__?: () => void;
      }
    ).__APERTURE_POINT_CLOUD_STOP__;
    stop?.();
  });
  webGpuValidation.expectNoWarnings();
  await page.close({ runBeforeUnload: false });
});
