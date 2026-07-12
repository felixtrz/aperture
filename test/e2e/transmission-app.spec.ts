import { expect, test, type Page } from "@playwright/test";

import {
  pixelDistance,
  readPngImage,
  readPngImagePixel,
  rgbaColorToPixel,
  type RgbaPixel,
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

// App-facade variant of transmission.spec.ts (parity plan A3 AC2): the same
// factor-driven glass scene authored through `material.standard()` spawn
// descriptors in a generated simulation worker. The textured-mask panel (and
// its GPU readback contrast report) is intentionally out of scope, so the
// pixel proofs sample the presented canvas via screenshot instead.

interface TransmissionAppStatus extends ExampleStatusBase {
  readonly state?: string;
  readonly transmission?: {
    readonly transmissionFactor: number;
    readonly roughness: {
      readonly glossy: number;
      readonly rough: number;
    };
    readonly stripeCount: number;
    readonly expectedMeshDraws: number;
  };
  readonly frame?: {
    readonly counts?: {
      readonly views: number;
      readonly meshDraws: number;
      readonly drawCalls: number;
      readonly diagnostics: number;
    } | null;
    readonly transmissionGrabPass?: {
      readonly enabled: boolean;
      readonly ok: boolean;
      readonly width: number;
      readonly height: number;
      readonly commands: number;
      readonly drawCalls: number;
      readonly textureResourceKey: string;
      readonly samplerResourceKey: string;
    } | null;
  };
}

const transmissionAppExpectedMeshDraws = 26;

// Same normalized sample points as the low-level transmission scene (minus
// the texture-mask samples): the camera framing is identical, so the ratios
// address the same world-space content regardless of backing-store size.
const transmissionAppSamplePoints = [
  { id: "glossy-dark", x: 0.2875, y: 0.5 },
  { id: "glossy-bright", x: 0.325, y: 0.5 },
  { id: "rough-dark", x: 0.6875, y: 0.5 },
  { id: "rough-bright", x: 0.725, y: 0.5 },
  { id: "background-glossy-dark", x: 0.2875, y: 0.72 },
  { id: "background-glossy-bright", x: 0.325, y: 0.72 },
  { id: "background-rough-dark", x: 0.6875, y: 0.72 },
  { id: "background-rough-bright", x: 0.725, y: 0.72 },
  { id: "through-glass", x: 0.2875, y: 0.5 },
  { id: "background", x: 0.325, y: 0.72 },
  { id: "clear", x: 0.08, y: 0.12 },
] as const;

type TransmissionAppSampleId =
  (typeof transmissionAppSamplePoints)[number]["id"];

test("app facade renders roughness-filtered transmission from material.standard() descriptors", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/transmission-app.html");

  const initialStatus = await waitForExampleStatus<TransmissionAppStatus>(page);

  expect(initialStatus, "transmission-app status should publish").toBeDefined();

  if (initialStatus === undefined) {
    return;
  }

  // The generated app publishes {state:"starting"} before WebGPU settles;
  // wait for a terminal state before deciding between skip and assert.
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: TransmissionAppStatus;
        }
      ).__APERTURE_EXAMPLE_STATUS__;

      return status !== undefined && status.state !== "starting";
    },
    undefined,
    { timeout: 60000 },
  );

  const settledStatus = await readTransmissionAppStatus(page);

  skipIfUnsupportedWebGpu(settledStatus);

  const status = await waitForTransmissionAppOk(page);

  await attachExampleStatus("transmission-app-status", status);
  expectStatusJsonSafeForGpu(status);

  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "transmission-app",
    ok: true,
    state: "running",
    renderingBackend: "webgpu-explicit",
    transmission: {
      transmissionFactor: 0.9,
      roughness: {
        glossy: 0.02,
        rough: 0.85,
      },
      stripeCount: 24,
      expectedMeshDraws: transmissionAppExpectedMeshDraws,
    },
    frame: {
      counts: {
        views: 1,
        meshDraws: transmissionAppExpectedMeshDraws,
        diagnostics: 0,
      },
      transmissionGrabPass: {
        enabled: true,
        ok: true,
        samplerResourceKey: "standard-transmission-grab:sampler",
      },
    },
  });
  expect(status.frame?.counts?.drawCalls ?? 0).toBeGreaterThanOrEqual(2);
  expect(status.frame?.transmissionGrabPass?.commands ?? 0).toBeGreaterThan(0);
  expect(
    status.frame?.transmissionGrabPass?.drawCalls ?? 0,
  ).toBeGreaterThanOrEqual(1);
  // The grab texture follows the swapchain format and the backing store
  // follows the layout box, so assert the resource-key shape, not exact dims.
  expect(status.frame?.transmissionGrabPass?.textureResourceKey).toMatch(
    /^standard-transmission-grab:scene-color:\d+:\d+:(rgba8unorm|bgra8unorm)$/,
  );

  await waitForPresentedFrames(page);

  const screenshot = await page.locator("#aperture-canvas").screenshot();

  await test.info().attach("transmission-app.png", {
    body: screenshot,
    contentType: "image/png",
  });

  assertTransmissionAppSamples(screenshot);
  webGpuValidation.expectNoWarnings();
});

function assertTransmissionAppSamples(screenshot: Buffer): void {
  const image = readPngImage(screenshot);
  const samples = new Map<TransmissionAppSampleId, RgbaPixel>(
    transmissionAppSamplePoints.map((point) => [
      point.id,
      readPngImagePixel(image, point.x, point.y),
    ]),
  );
  const clear = rgbaColorToPixel({ r: 0.018, g: 0.022, b: 0.028, a: 1 });
  const throughGlass = requiredSample(samples, "through-glass");
  const background = requiredSample(samples, "background");
  const clearSample = requiredSample(samples, "clear");
  const glossyContrast = pixelDistance(
    requiredSample(samples, "glossy-dark"),
    requiredSample(samples, "glossy-bright"),
  );
  const roughContrast = pixelDistance(
    requiredSample(samples, "rough-dark"),
    requiredSample(samples, "rough-bright"),
  );
  const backgroundGlossyContrast = pixelDistance(
    requiredSample(samples, "background-glossy-dark"),
    requiredSample(samples, "background-glossy-bright"),
  );
  const backgroundRoughContrast = pixelDistance(
    requiredSample(samples, "background-rough-dark"),
    requiredSample(samples, "background-rough-bright"),
  );

  // Same visual-contrast semantics as transmission.spec.ts: the glass pixel
  // differs from both the clear color and the adjacent bare background, the
  // background stripes keep strong contrast, and the rough sphere blurs the
  // stripes so its dark/bright samples converge relative to the glossy one.
  expect(pixelDistance(background, clear)).toBeGreaterThan(80);
  expect(pixelDistance(throughGlass, clear)).toBeGreaterThan(60);
  expect(pixelDistance(clearSample, clear)).toBeLessThan(8);
  expect(throughGlass.r).toBeGreaterThan(90);
  expect(throughGlass.g).toBeGreaterThan(80);
  expect(throughGlass.b).toBeGreaterThan(70);
  expect(throughGlass.r).toBeGreaterThan(background.r * 0.3);
  expect(backgroundGlossyContrast).toBeGreaterThan(70);
  expect(backgroundRoughContrast).toBeGreaterThan(70);
  expect(glossyContrast).toBeGreaterThan(25);
  expect(roughContrast).toBeLessThan(glossyContrast * 0.85);
}

function requiredSample(
  samples: ReadonlyMap<TransmissionAppSampleId, RgbaPixel>,
  id: TransmissionAppSampleId,
): RgbaPixel {
  const sample = samples.get(id);

  expect(sample, `missing screenshot sample '${id}'`).toBeDefined();

  return sample as RgbaPixel;
}

async function readTransmissionAppStatus(
  page: Page,
): Promise<TransmissionAppStatus> {
  return page.evaluate(
    () =>
      (
        globalThis as unknown as {
          readonly __APERTURE_EXAMPLE_STATUS__: TransmissionAppStatus;
        }
      ).__APERTURE_EXAMPLE_STATUS__,
  );
}

async function waitForTransmissionAppOk(
  page: Page,
): Promise<TransmissionAppStatus> {
  await page.waitForFunction(
    (expectedMeshDraws) => {
      const status = (
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: TransmissionAppStatus;
        }
      ).__APERTURE_EXAMPLE_STATUS__;

      return (
        status?.ok === true &&
        status.frame?.counts?.meshDraws === expectedMeshDraws &&
        status.frame?.transmissionGrabPass?.ok === true
      );
    },
    transmissionAppExpectedMeshDraws,
    { timeout: 120000 },
  );

  return readTransmissionAppStatus(page);
}
