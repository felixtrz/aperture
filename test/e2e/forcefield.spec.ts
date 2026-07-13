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

interface ForcefieldStatus extends ExampleStatusBase {
  readonly msaaVariant?: boolean;
  readonly forcefieldPipelineKey?: string | null;
  readonly overlayRan?: boolean;
  readonly sceneDepthOverlays?: number;
  readonly msaa?: {
    readonly sampleCount?: number;
    readonly enabled?: boolean;
  } | null;
  readonly sceneDepthDiagnostics?: readonly string[];
  readonly samplePoints?: readonly {
    readonly id: string;
    readonly x: number;
    readonly y: number;
  }[];
}

// B4 (three.js parity plan, advanced-audit scenario #19): a transparent custom
// WGSL material samples the renderer-owned SCENE DEPTH (read-only, post-opaque)
// to fade a soft-edge intersection "forcefield". The forcefield slab renders at
// a CONSTANT depth over the whole view; a wall sits just behind its LEFT half
// (near) while the RIGHT half sees only the far background — so the RED
// intersection glow appears on the left (near geometry) and not the right
// (far), isolating the depth-driven fade. The MSAA variant samples the depth as
// a multisampled attachment through the MSAA-aware read-only-depth boundary.

async function runForcefield(
  page: Page,
  path: string,
  example: string,
  expectMsaa: boolean,
): Promise<void> {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.setViewportSize({ width: 1024, height: 720 });
  await page.goto(path);

  const status = await waitForExampleStatus<ForcefieldStatus>(page);
  await attachExampleStatus(`${example}-status`, status);
  expect(status, "status should publish").toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example,
    ok: true,
    phase: "submit",
    renderingBackend: "webgpu-explicit",
    overlayRan: true,
  });

  // The scene-depth custom material compiled + drew, and no scene-depth
  // diagnostic fired.
  expect(status.forcefieldPipelineKey ?? "").toContain("example/forcefield");
  expect(status.sceneDepthDiagnostics ?? []).toEqual([]);

  // The forcefield rendered in a post-opaque read-only-depth OVERLAY boundary
  // (the report counts scene-depth overlays that ran this frame).
  expect(status.sceneDepthOverlays ?? 0).toBeGreaterThan(0);

  if (expectMsaa) {
    expect(status.msaa?.enabled).toBe(true);
    expect(status.msaa?.sampleCount ?? 1).toBeGreaterThan(1);
  }

  // Pixel assertions (canvas screenshot at the published sample points).
  await waitForPresentedFrames(page);
  const screenshot = await page.locator("#forcefield-canvas").screenshot();
  await test.info().attach(`${example}-canvas`, {
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
  await test.info().attach(`${example}-pixels`, {
    body: JSON.stringify([...pixels.entries()], null, 2),
    contentType: "application/json",
  });

  const leftGlow = pixels.get("left-glow");
  const leftGlowTop = pixels.get("left-glow-top");
  const rightBase = pixels.get("right-base");
  const rightBaseBottom = pixels.get("right-base-bottom");

  expect(leftGlow, "left-glow sampled").toBeDefined();
  expect(rightBase, "right-base sampled").toBeDefined();

  // Depth-fade proof: the RED intersection glow is present where the wall sits
  // just behind the forcefield (left) and absent over the far background
  // (right). Red comes ONLY from the glow, so this isolates the depth fade.
  const leftRed = leftGlow?.r ?? 0;
  const rightRed = rightBase?.r ?? 255;
  expect(leftRed).toBeGreaterThan(90);
  expect(rightRed).toBeLessThan(90);
  expect(leftRed - rightRed).toBeGreaterThan(40);

  // Consistent across a second pair of near/far samples.
  expect(leftGlowTop?.r ?? 0).toBeGreaterThan(rightBaseBottom?.r ?? 255);

  // The forcefield is genuinely present over the far background (its blue base
  // shows), not a hole punched to the clear colour.
  expect(rightBase?.b ?? 0).toBeGreaterThan(40);

  await page.evaluate(() => {
    const stop = (
      globalThis as typeof globalThis & {
        readonly __APERTURE_FORCEFIELD_STOP__?: () => void;
      }
    ).__APERTURE_FORCEFIELD_STOP__;
    stop?.();
  });
  webGpuValidation.expectNoWarnings();
  await page.close({ runBeforeUnload: false });
}

test("browser renders a forcefield custom material fading against scene depth", async ({
  page,
}) => {
  await runForcefield(page, "/examples/forcefield.html", "forcefield", false);
});

test("browser renders the forcefield depth-fade through the MSAA-aware depth path", async ({
  page,
}) => {
  await runForcefield(
    page,
    "/examples/forcefield-msaa.html",
    "forcefield-msaa",
    true,
  );
});
