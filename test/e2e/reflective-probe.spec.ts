import { expect, test } from "@playwright/test";

import { pixelDistance } from "./png.js";
import {
  attachExampleStatus,
  expectStatusJsonSafeForGpu,
  skipIfUnsupportedWebGpu,
  waitForExampleStatus,
} from "./webgpu-status.js";
import type { ExampleStatusBase } from "./example-status-types.js";

interface RgbaPixel {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
}

interface ProbeFrameLogEntry {
  readonly frame: number;
  readonly faces: number;
  readonly captureGeneration: number | null;
  readonly spherePixel?: RgbaPixel;
}

interface ReflectiveProbeStatus extends ExampleStatusBase {
  readonly extraction?: {
    readonly views: number;
    readonly meshDraws: number;
    readonly environments: number;
    readonly diagnostics: number;
  };
  readonly probe?: {
    readonly renderTargetKey: string;
    readonly faceSize: number;
    readonly captureEvery: number;
    readonly faceSubmissionsThisFrame: number;
    readonly captureGeneration: number;
    readonly frameLog: readonly ProbeFrameLogEntry[];
  };
  readonly environment?: {
    readonly ready: boolean;
    readonly specularPrefiltering: boolean;
    readonly diffuseConvolved: boolean;
  };
  readonly readback?: {
    readonly ok: boolean;
    readonly reason?: string;
    readonly samples?: readonly {
      readonly id: string;
      readonly pixel: RgbaPixel;
    }[];
  };
}

// B2 (three.js parity plan): reflective sphere lit by a periodically
// re-captured cube probe. Asserts (AC2/AC3) the probe re-render cadence via
// frame-report pass counts and pixel-level correctness of the reflection.
test("reflective-probe re-captures the cube probe on schedule and reflects the moving scene", async ({
  page,
}) => {
  await page.goto("/examples/reflective-probe.html");

  const initial = await waitForExampleStatus<ReflectiveProbeStatus>(page);
  expect(initial, "reflective-probe status should publish").toBeDefined();
  if (initial === undefined) {
    throw new Error("reflective-probe status did not publish.");
  }
  skipIfUnsupportedWebGpu(initial);

  // Let the probe re-capture enough times for the orbit to sweep the red box
  // across (and away from) the sphere-centre reflection direction.
  await page.waitForFunction(() => {
    const status = (
      globalThis as typeof globalThis & {
        readonly __APERTURE_EXAMPLE_STATUS__?: ReflectiveProbeStatus;
      }
    ).__APERTURE_EXAMPLE_STATUS__;

    return (
      status?.ok === true &&
      status.readback?.ok === true &&
      (status.probe?.captureGeneration ?? 0) >= 8
    );
  });

  const status = await waitForExampleStatus<ReflectiveProbeStatus>(page);
  if (status === undefined) {
    throw new Error("reflective-probe status disappeared.");
  }

  await attachExampleStatus("reflective-probe", status);
  expectStatusJsonSafeForGpu(status);

  expect(status, JSON.stringify(status.probe, null, 2)).toMatchObject({
    example: "reflective-probe",
    ok: true,
    probe: {
      renderTargetKey: "render-target:reflective-probe.env",
      faceSize: 32,
      captureEvery: 4,
    },
    environment: {
      ready: true,
      specularPrefiltering: true,
      diffuseConvolved: true,
    },
  });

  const probe = status.probe;
  if (probe === undefined) {
    throw new Error("reflective-probe status is missing the probe report.");
  }

  // (AC3) Capture cost is scheduled and opt-in: every logged frame submitted
  // either six face passes (capture frame) or none, and capture frames are
  // exactly the prime frame plus the every-4 schedule.
  expect(probe.frameLog.length).toBeGreaterThanOrEqual(28);

  for (const entry of probe.frameLog) {
    const scheduled =
      entry.frame === 1 || entry.frame % probe.captureEvery === 0;

    expect(
      entry.faces,
      `frame ${entry.frame} should ${scheduled ? "capture 6 faces" : "skip the probe"}`,
    ).toBe(scheduled ? 6 : 0);
  }

  // (AC2) Probe re-render count: the capture generation advances by exactly
  // one per capture frame.
  const captureEntries = probe.frameLog.filter((entry) => entry.faces === 6);

  expect(captureEntries.length).toBeGreaterThanOrEqual(6);

  for (let index = 1; index < captureEntries.length; index += 1) {
    const previous = captureEntries[index - 1];
    const current = captureEntries[index];

    expect(current?.captureGeneration).toBe(
      (previous?.captureGeneration ?? 0) + 1,
    );
  }

  // (AC2) Pixel-level correctness: the sphere-centre reflection follows the
  // re-captured orbit — the red box starts on the reflected axis (bright,
  // red-dominant) and orbits away (the reflection visibly changes).
  const spherePixels = probe.frameLog.flatMap((entry) =>
    entry.spherePixel === undefined ? [] : [entry.spherePixel],
  );

  const firstSpherePixel = spherePixels[0];

  expect(spherePixels.length).toBeGreaterThanOrEqual(20);
  if (firstSpherePixel === undefined) {
    throw new Error("reflective-probe frame log has no sphere pixels.");
  }

  let maxDistance = 0;

  for (const pixel of spherePixels) {
    maxDistance = Math.max(maxDistance, pixelDistance(pixel, firstSpherePixel));
  }

  expect(
    maxDistance,
    `the reflection should change across captures; pixels=${JSON.stringify(
      spherePixels.slice(0, 8),
    )}`,
  ).toBeGreaterThan(50);

  // The brightest sampled reflection is red-dominant (the red box crossing
  // the reflected +Z axis right after the first captures).
  const brightest = spherePixels.reduce((best, pixel) =>
    pixel.r + pixel.g + pixel.b > best.r + best.g + best.b ? pixel : best,
  );

  expect(
    brightest.r,
    `the brightest reflection should come from the red box; brightest=${JSON.stringify(brightest)}`,
  ).toBeGreaterThan(80);
  expect(brightest.r).toBeGreaterThan(brightest.b);

  // The background stays on the clear color — the probe renders offscreen.
  const background = status.readback?.samples?.find(
    (sample) => sample.id === "background",
  );

  if (background === undefined) {
    throw new Error(
      "reflective-probe status is missing the background sample.",
    );
  }

  expect(
    pixelDistance(background.pixel, { r: 3, g: 3, b: 5, a: 255 }),
  ).toBeLessThan(16);
});
