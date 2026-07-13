import { expect, test, type Page } from "@playwright/test";

import { readPngImage, readPngImagePixel, type RgbaPixel } from "./png.js";
import {
  attachExampleStatus,
  attachWebGpuValidationConsoleGuard,
  expectStatusJsonSafeForGpu,
  skipIfUnsupportedWebGpu,
  waitForExampleStatus,
  waitForPresentedFrames,
} from "./webgpu-status.js";
import type { ExampleStatusBase } from "./example-status-types.js";

interface DecalReport {
  readonly capacity?: number;
  readonly live?: number;
  readonly evicted?: number;
  readonly submitted?: number;
  readonly drawn?: number;
  readonly textureBatches?: number;
}

interface DecalsStatus extends ExampleStatusBase {
  readonly decalReport?: DecalReport | null;
  readonly capacity?: number;
  readonly shots?: number;
  readonly liveHistory?: readonly number[];
  readonly evictedHistory?: readonly number[];
  readonly decalDiagnostics?: readonly string[];
  readonly samplePoints?: readonly {
    readonly id: string;
    readonly x: number;
    readonly y: number;
  }[];
}

// D4 (advanced-audit scenario #17): FPS-style bullet-hole decals accumulate on
// an opaque wall, depth-biased projected onto it (no z-fighting), capped at a
// live-decal limit with oldest-first eviction. The newest decals survive over
// the RIGHT half of the wall (orange), while the oldest are evicted so the LEFT
// half returns to bare wall — the cap + eviction is asserted straight from the
// per-frame report and confirmed by the on-wall pixels.
test("browser accumulates capped, evicting projected decals on a wall", async ({
  page,
}: {
  page: Page;
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.setViewportSize({ width: 1024, height: 720 });
  await page.goto("/examples/decals.html");

  const status = await waitForExampleStatus<DecalsStatus>(page);
  await attachExampleStatus("decals-status", status);
  expect(status, "status should publish").toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "decals",
    ok: true,
    phase: "submit",
    renderingBackend: "webgpu-explicit",
  });

  // Cap + eviction proof, straight from the frame report.
  const report = status.decalReport ?? {};
  expect(report.capacity).toBe(6);
  expect(report.live, "live decals cap at the capacity").toBe(6);
  expect(report.submitted, "every shot was submitted").toBe(12);
  expect(report.evicted, "the oldest decals were evicted").toBe(6);
  expect(status.decalDiagnostics ?? []).toEqual([]);

  // The live count grows to the cap then plateaus (never exceeds it); eviction
  // begins once the cap is hit.
  const liveHistory = status.liveHistory ?? [];
  const evictedHistory = status.evictedHistory ?? [];
  expect(liveHistory).toHaveLength(12);
  expect(Math.max(...liveHistory)).toBe(6);
  expect(liveHistory[liveHistory.length - 1]).toBe(6);
  expect(liveHistory[0]).toBe(1);
  expect(evictedHistory[evictedHistory.length - 1]).toBe(6);

  // Pixel assertions (canvas screenshot at the published sample points).
  await waitForPresentedFrames(page);
  const screenshot = await page.locator("#decals-canvas").screenshot();
  await test.info().attach("decals-canvas", {
    body: screenshot,
    contentType: "image/png",
  });
  const image = readPngImage(screenshot);
  const samplePoints = status.samplePoints ?? [];
  const pixels = new Map<string, RgbaPixel>(
    samplePoints.map((point) => [
      point.id,
      readPngImagePixel(image, point.x, point.y),
    ]),
  );
  await test.info().attach("decals-pixels", {
    body: JSON.stringify([...pixels.entries()], null, 2),
    contentType: "application/json",
  });

  const decalHitA = pixels.get("decal-hit-a");
  const decalHitB = pixels.get("decal-hit-b");
  const evictedA = pixels.get("evicted-a");
  const evictedB = pixels.get("evicted-b");

  expect(decalHitA, "decal-hit-a sampled").toBeDefined();
  expect(evictedA, "evicted-a sampled").toBeDefined();

  // A surviving decal turned a wall pixel decal-orange (high red); an evicted
  // slot returned to the blue-grey wall (low red). Red isolates the decal.
  const hitRed = decalHitA?.r ?? 0;
  const evictedRed = evictedA?.r ?? 255;
  expect(hitRed, "surviving decal is orange").toBeGreaterThan(140);
  expect(decalHitA?.b ?? 255, "decal is not blue wall").toBeLessThan(120);
  expect(evictedRed, "evicted slot is bare wall").toBeLessThan(110);
  expect(hitRed - evictedRed, "decal vs evicted separation").toBeGreaterThan(
    50,
  );

  // Consistent across the second pair of samples.
  expect(decalHitB?.r ?? 0).toBeGreaterThan(evictedB?.r ?? 255);

  await page.evaluate(() => {
    const stop = (
      globalThis as typeof globalThis & {
        readonly __APERTURE_DECALS_STOP__?: () => void;
      }
    ).__APERTURE_DECALS_STOP__;
    stop?.();
  });
  webGpuValidation.expectNoWarnings();
  await page.close({ runBeforeUnload: false });
});
